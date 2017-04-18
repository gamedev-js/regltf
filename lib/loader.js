import {Node, utils} from 'scene-graph';
import {vec3, quat} from 'vmath';

import resl from './resl';
import builtinPrograms from './builtin-programs';
import builtinTechniques from './builtin-techniques';

let _programs = {};
for (let name in builtinPrograms) {
  _programs[name] = builtinPrograms[name];
}

let _techniques = {};
for (let name in builtinTechniques) {
  _techniques[name] = builtinTechniques[name];
}

function _walk(scene, fn) {
  scene.nodes.forEach(node => {
    fn(node);
    utils.walk(node, child => {
      fn(child);
    });
  });
}

function _replace(scene, oldNode, newNode) {
  if (oldNode._parent) {
    return utils.replace(oldNode, newNode);
  }

  for (let i = 0; i < scene.nodes.length; ++i) {
    if (scene.nodes[i] === oldNode) {
      scene.nodes[i] = newNode;
      return;
    }
  }
}

function _serializeCommands(regl, json, commands) {
  for ( let techID in _techniques ) {
    let gltfTechnique = _techniques[techID];
    let gltfProgram = _programs[gltfTechnique.program];

    // draw options
    let opts = {
      // frontFace: 'ccw',
      cull: {
        enable: true,
        face: 'back'
      },

      vert: gltfProgram.vertexShader,
      frag: gltfProgram.fragmentShader,

      primitive: regl.prop('primitive'),
      offset: regl.prop('offset'),
      count: regl.prop('count'),

      elements: regl.prop('elements'),
      attributes: {},
      uniforms: {},
    };
    for (let attrName in gltfTechnique.attributes) {
      opts.attributes[attrName] = regl.prop(`attributes.${attrName}`);
    }
    for (let uniformName in gltfTechnique.uniforms) {
      opts.uniforms[uniformName] = regl.prop(`uniforms.${uniformName}`);
    }
    // TODO: states
    // TODO: functions

    // finalize
    commands[techID] = regl(opts);
  }
}

function _serializeNodes(json, parent, childrenIDs, out) {
  childrenIDs.forEach(nodeID => {
    let gltfNode = json.nodes[nodeID];
    let node = new Node(gltfNode.name);
    let data;

    node._id = nodeID;
    node._parent = parent;

    data = gltfNode.translation;
    node.lpos = data ?
      vec3.new(data[0], data[1], data[2]) :
      vec3.new(0, 0, 0)
      ;

    data = gltfNode.rotation;
    node.lrot = data ?
      quat.new(data[0], data[1], data[2], data[3]) :
      quat.new(0, 0, 0, 1)
      ;

    data = gltfNode.scale;
    node.lscale = data ?
      vec3.new(data[0], data[1], data[2]) :
      vec3.new(1, 1, 1)
      ;

    node._meshes = gltfNode.meshes;
    node._skeletons = gltfNode.skeletons;
    node._skin = gltfNode.skin;
    node._extras = gltfNode.extras;

    if (gltfNode.children) {
      _serializeNodes(json, node, gltfNode.children, node.children);
    }

    out.push(node);
  });

  return out;
}

function _serializeJoint(json, parent, id, joints) {
  let node = joints[id];
  if (node) {
    if (parent) {
      node._parent = parent;
      parent.children.push(node);
    }

    return;
  }

  let gltfNode = json.nodes[id];
  node = new Node(gltfNode.name);

  node._id = id;
  node._parent = parent;

  let data;
  data = gltfNode.translation;
  node.lpos = data ?
    vec3.new(data[0], data[1], data[2]) :
    vec3.new(0, 0, 0)
    ;

  data = gltfNode.rotation;
  node.lrot = data ?
    quat.new(data[0], data[1], data[2], data[3]) :
    quat.new(0, 0, 0, 1)
    ;

  data = gltfNode.scale;
  node.lscale = data ?
    vec3.new(data[0], data[1], data[2]) :
    vec3.new(1, 1, 1)
    ;

  joints[id] = node;

  if (parent) {
    parent.children.push(node);
  }

  if (gltfNode.children) {
    gltfNode.children.forEach(childNodeID => {
      _serializeJoint(json, node, childNodeID, joints);
    });
  }
}

function _serializeTextures(regl, json, textures, callback) {
  let manifest = {};

  for ( let name in json.textures ) {
    let gltfTexture = json.textures[name];
    let gltfImage = json.images[gltfTexture.source];
    // TODO:
    // let gltfSampler = json.sampler[gltfTexture.sampler];

    textures[name] = regl.texture();
    manifest[name] = {
      type: 'image',
      src: `${json.baseURL}/${gltfImage.uri}`
    };
  }

  resl({
    manifest,
    onError(err) {
      console.error(err);
    },
    onDone(assets) {
      for (let name in assets) {
        textures[name]({
          data: assets[name],
          wrapS: 'repeat',
          wrapT: 'repeat',
          mag: 'linear',
          min: 'mipmap',
          mipmap: 'nice',
          flipY: true
        });
      }

      if (callback) {
        callback(null, textures);
      }
    },
  });
}

function _serializeBuffers(regl, json, buffers, callback) {
  let manifest = {};
  let buffer2viewIDs = {};

  for ( let id in json.buffers ) {
    let gltfBuffer = json.buffers[id];
    manifest[id] = {
      type: 'binary',
      src: `${json.baseURL}/${gltfBuffer.uri}`
    };
    buffer2viewIDs[id] = [];
  }

  for ( let id in json.bufferViews ) {
    let gltfBufferView = json.bufferViews[id];
    if ( gltfBufferView.target === regl._gl.ARRAY_BUFFER ) {
      buffers[id] = regl.buffer(gltfBufferView.byteLength);
    } else if ( gltfBufferView.target === regl._gl.ELEMENT_ARRAY_BUFFER ) {
      buffers[id] = regl.elements(gltfBufferView.byteLength);
    } else {
      buffers[id] = new ArrayBuffer();
    }

    buffer2viewIDs[gltfBufferView.buffer].push(id);
  }

  resl({
    manifest,
    onError(err) {
      console.error(err);
    },
    onDone(assets) {
      for ( let id in assets ) {
        let viewIDs = buffer2viewIDs[id];
        viewIDs.forEach(viewID => {
          let gltfBufferView = json.bufferViews[viewID];
          if ( gltfBufferView.target ) {
            let reglBuf = buffers[viewID];
            reglBuf({
              type: 'uint16', // HACK
              data: new Uint8Array(assets[id], gltfBufferView.byteOffset, gltfBufferView.byteLength)
            });
          } else {
            // ArrayBuffer.slice
            buffers[viewID] = assets[id].slice(
              gltfBufferView.byteOffset,
              gltfBufferView.byteOffset + gltfBufferView.byteLength
            );
          }
        });
      }

      if (callback) {
        callback(null, buffers);
      }
    }
  });
}

function _serializePrefabs(regl, json, scene, prefabs, callback) {
  if (!json.extras || !json.extras.prefabs) {
    if (callback) {
      callback(null, prefabs);
    }

    return;
  }

  let count = 0;
  let manifest = {};
  for (let id in json.extras.prefabs) {
    let asset = json.extras.prefabs[id];
    manifest[id] = {
      type: 'text',
      src: `${json.baseURL}/${asset.uri}`,
      parser: JSON.parse
    };
    ++count;
  }

  resl({
    manifest,
    onError(err) {
      console.error(err);
    },
    onDone(assets) {
      for ( let id in assets ) {
        let url = manifest[id].src;
        let prefabJson = assets[id];

        let idx = url.lastIndexOf('/');
        if (idx !== -1) {
          prefabJson.baseURL = url.substring(0, idx);
        } else {
          prefabJson.baseURL = url;
        }

        _serializeGLTF(regl, prefabJson, scene, (err, result) => {
          prefabs[id] = result;

          --count;
          if (count === 0 && callback) {
            callback(null, prefabs);
          }
        });
      }
    }
  });
}

function _serializeGLTF(regl, json, scene, callback) {
  let gltfScene = json.scenes[json.scene];
  let result = {
    name: gltfScene.name,
    json: json,
    nodes: [],
    joints: {},
  };

  // update programs & techinques
  for (let name in json.programs) {
    _programs[name] = json.programs[name];
  }
  for ( let name in json.techniques ) {
    _techniques[name] = json.techniques[name];
  }

  // serialize gltf globally
  scene.programs = _programs;
  scene.techniques = _techniques;
  for ( let id in json.meshes ) {
    scene.meshes[id] = json.meshes[id];
  }
  for ( let id in json.materials ) {
    scene.materials[id] = json.materials[id];
  }
  for ( let id in json.accessors ) {
    scene.accessors[id] = json.accessors[id];
  }

  // serialize commands
  _serializeCommands(regl, json, scene.commands);

  // serialize nodes
  _serializeNodes(json, null, gltfScene.nodes, result.nodes);

  // serialize joints
  for (let id in json.nodes) {
    let node = json.nodes[id];
    if (node.jointName) {
      _serializeJoint(json, null, id, result.joints);
    }
  }

  // serialize textures
  _serializeTextures(regl, json, scene.textures);

  // serialize buffers
  _serializeBuffers(regl, json, scene.buffers);

  // serialize extras.prefabs
  _serializePrefabs(regl, json, scene, scene.prefabs, (err, prefabs) => {
    _walk(result, child => {
      if (child._extras && child._extras.prefab) {
        let prefabID = child._extras.prefab;
        let prefab = prefabs[prefabID];
        let root = prefab.nodes[0];
        let prefabNode = root.deepClone((newNode, oldNode) => {
          newNode._meshes = oldNode._meshes;
          newNode._skeletons = oldNode._skeletons;
          newNode._skin = oldNode._skin;
          newNode._extras = oldNode._extras;
        });
        vec3.copy(prefabNode.lpos, child.lpos);
        vec3.copy(prefabNode.lscale, child.lscale);
        quat.copy(prefabNode.lrot, child.lrot);

        _replace(result, child, prefabNode);

        scene._dirty = true;
      }
    });
  });

  // done
  callback(null, result);
}

export default function load (regl, url, callback) {
  resl({
    manifest: {
      json: {
        type: 'text',
        src: url,
        parser: JSON.parse
      }
    },

    onDone(assets) {
      let idx = url.lastIndexOf('/');
      if (idx !== -1) {
        assets.json.baseURL = url.substring(0,idx);
      } else {
        assets.json.baseURL = url;
      }

      let scene = {
        _dirty: false,

        //
        name: '',
        json: '',
        nodes: [],
        joints: {},

        // gltf (global)
        techniques: {},
        programs: {},
        meshes: {},
        materials: {},
        accessors: {},

        // resources
        textures: {}, // texture id to regl texture
        buffers: {},  // buffer-view id to regl buffer
        prefabs: {}, // serialized prefabs
        commands: {}, // technique id to regl command
      };
      _serializeGLTF(regl, assets.json, scene, (err,result) => {
        scene.name = result.name;
        scene.json = result.json;
        scene.nodes = result.nodes;
        scene.joints = result.joints;

        if (callback) {
          callback(null, scene);
        }
      });
    },

    onError(err) {
      console.error(err);
      callback(err);
    }
  });
}