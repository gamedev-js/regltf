
/*
 * regltf v1.0.0
 * (c) 2017 @Johnny Wu
 * Released under the MIT License.
 */

(function (exports,memop,sceneGraph,vmath) {
'use strict';

let f32a_m4_pool = new memop.FramePool(function() {
  return new Float32Array(16);
}, 256);

/**
 * (c) 2016 Mikola Lysenko. MIT License
 * https://github.com/regl-project/resl
 */

/* global XMLHttpRequest */
const configParameters = [
  'manifest',
  'onDone',
  'onProgress',
  'onError'
];

const manifestParameters = [
  'type',
  'src',
  'stream',
  'credentials',
  'parser'
];

const parserParameters = [
  'onData',
  'onDone'
];

const STATE_ERROR = -1;
const STATE_DATA = 0;
const STATE_COMPLETE = 1;

function raise(message) {
  throw new Error('resl: ' + message);
}

function checkType(object, parameters, name) {
  Object.keys(object).forEach(function (param) {
    if (parameters.indexOf(param) < 0) {
      raise('invalid parameter "' + param + '" in ' + name);
    }
  });
}

function Loader(name, cancel) {
  this.state = STATE_DATA;
  this.ready = false;
  this.progress = 0;
  this.name = name;
  this.cancel = cancel;
}

function resl(config) {
  if (typeof config !== 'object' || !config) {
    raise('invalid or missing configuration');
  }

  checkType(config, configParameters, 'config');

  let manifest = config.manifest;
  if (typeof manifest !== 'object' || !manifest) {
    raise('missing manifest');
  }

  function getFunction(name) {
    if (name in config) {
      let func = config[name];
      if (typeof func !== 'function') {
        raise('invalid callback "' + name + '"');
      }
      return func;
    }
    return null;
  }

  let onDone = getFunction('onDone');
  if (!onDone) {
    raise('missing onDone() callback');
  }

  let onProgress = getFunction('onProgress');
  let onError = getFunction('onError');

  let assets = {};

  let state = STATE_DATA;

  function loadXHR(request) {
    let name = request.name;
    let stream = request.stream;
    let binary = request.type === 'binary';
    let parser = request.parser;

    let xhr = new XMLHttpRequest();
    let asset = null;

    let loader = new Loader(name, cancel);

    if (stream) {
      xhr.onreadystatechange = onReadyStateChange;
    } else {
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          onReadyStateChange();
        }
      };
    }

    if (binary) {
      xhr.responseType = 'arraybuffer';
    }

    function onReadyStateChange() {
      if (xhr.readyState < 2 ||
        loader.state === STATE_COMPLETE ||
        loader.state === STATE_ERROR) {
        return;
      }
      if (xhr.status !== 200) {
        return abort('error loading resource "' + request.name + '"');
      }
      if (xhr.readyState > 2 && loader.state === STATE_DATA) {
        let response;
        if (request.type === 'binary') {
          response = xhr.response;
        } else {
          response = xhr.responseText;
        }
        if (parser.data) {
          try {
            asset = parser.data(response);
          } catch (e) {
            return abort(e);
          }
        } else {
          asset = response;
        }
      }
      if (xhr.readyState > 3 && loader.state === STATE_DATA) {
        if (parser.done) {
          try {
            asset = parser.done();
          } catch (e) {
            return abort(e);
          }
        }
        loader.state = STATE_COMPLETE;
      }
      assets[name] = asset;
      loader.progress = 0.75 * loader.progress + 0.25;
      loader.ready =
        (request.stream && !!asset) ||
        loader.state === STATE_COMPLETE;
      notifyProgress();
    }

    function cancel() {
      if (loader.state === STATE_COMPLETE || loader.state === STATE_ERROR) {
        return;
      }
      xhr.onreadystatechange = null;
      xhr.abort();
      loader.state = STATE_ERROR;
    }

    // set up request
    if (request.credentials) {
      xhr.withCredentials = true;
    }
    xhr.open('GET', request.src, true);
    xhr.send();

    return loader;
  }

  function loadElement(request, element) {
    let name = request.name;
    let parser = request.parser;

    let loader = new Loader(name, cancel);
    let asset = element;

    function handleProgress() {
      if (loader.state === STATE_DATA) {
        if (parser.data) {
          try {
            asset = parser.data(element);
          } catch (e) {
            return abort(e);
          }
        } else {
          asset = element;
        }
      }
    }

    function onProgress(e) {
      handleProgress();
      assets[name] = asset;
      if (e.lengthComputable) {
        loader.progress = Math.max(loader.progress, e.loaded / e.total);
      } else {
        loader.progress = 0.75 * loader.progress + 0.25;
      }
      notifyProgress(name);
    }

    function onComplete() {
      handleProgress();
      if (loader.state === STATE_DATA) {
        if (parser.done) {
          try {
            asset = parser.done();
          } catch (e) {
            return abort(e);
          }
        }
        loader.state = STATE_COMPLETE;
      }
      loader.progress = 1;
      loader.ready = true;
      assets[name] = asset;
      removeListeners();
      notifyProgress('finish ' + name);
    }

    function onError() {
      abort('error loading asset "' + name + '"');
    }

    if (request.stream) {
      element.addEventListener('progress', onProgress);
    }
    if (request.type === 'image') {
      element.addEventListener('load', onComplete);
    } else {
      let canPlay = false;
      let loadedMetaData = false;
      element.addEventListener('loadedmetadata', function () {
        loadedMetaData = true;
        if (canPlay) {
          onComplete();
        }
      });
      element.addEventListener('canplay', function () {
        canPlay = true;
        if (loadedMetaData) {
          onComplete();
        }
      });
    }
    element.addEventListener('error', onError);

    function removeListeners() {
      if (request.stream) {
        element.removeEventListener('progress', onProgress);
      }
      if (request.type === 'image') {
        element.addEventListener('load', onComplete);
      } else {
        element.addEventListener('canplay', onComplete);
      }
      element.removeEventListener('error', onError);
    }

    function cancel() {
      if (loader.state === STATE_COMPLETE || loader.state === STATE_ERROR) {
        return;
      }

      loader.state = STATE_ERROR;
      removeListeners();
      element.src = '';
    }

    // set up request
    if (request.credentials) {
      element.crossOrigin = 'use-credentials';
    } else {
      element.crossOrigin = 'anonymous';
    }
    element.src = request.src;

    return loader;
  }

  let loaders = {
    text: loadXHR,
    binary: function (request) {
      // TODO use fetch API for streaming if supported
      return loadXHR(request);
    },
    image: function (request) {
      return loadElement(request, document.createElement('img'));
    },
    video: function (request) {
      return loadElement(request, document.createElement('video'));
    },
    audio: function (request) {
      return loadElement(request, document.createElement('audio'));
    }
  };

  // First we parse all objects in order to verify that all type information
  // is correct
  let pending = Object.keys(manifest).map(function (name) {
    let request = manifest[name];
    if (typeof request === 'string') {
      request = {
        src: request
      };
    } else if (typeof request !== 'object' || !request) {
      raise('invalid asset definition "' + name + '"');
    }

    checkType(request, manifestParameters, 'asset "' + name + '"');

    function getParameter(prop, accepted, init) {
      let value = init;
      if (prop in request) {
        value = request[prop];
      }
      if (accepted.indexOf(value) < 0) {
        raise('invalid ' + prop + ' "' + value + '" for asset "' + name + '", possible values: ' + accepted);
      }
      return value;
    }

    function getString(prop, required, init) {
      let value = init;
      if (prop in request) {
        value = request[prop];
      } else if (required) {
        raise('missing ' + prop + ' for asset "' + name + '"');
      }
      if (typeof value !== 'string') {
        raise('invalid ' + prop + ' for asset "' + name + '", must be a string');
      }
      return value;
    }

    function getParseFunc(name, dflt) {
      if (name in request.parser) {
        let result = request.parser[name];
        if (typeof result !== 'function') {
          raise('invalid parser callback ' + name + ' for asset "' + name + '"');
        }
        return result;
      } else {
        return dflt;
      }
    }

    let parser = {};
    if ('parser' in request) {
      if (typeof request.parser === 'function') {
        parser = {
          data: request.parser
        };
      } else if (typeof request.parser === 'object' && request.parser) {
        checkType(request.parser, parserParameters, 'parser for asset "' + name + '"');
        if (!('onData' in request.parser)) {
          raise('missing onData callback for parser in asset "' + name + '"');
        }
        parser = {
          data: getParseFunc('onData'),
          done: getParseFunc('onDone')
        };
      } else {
        raise('invalid parser for asset "' + name + '"');
      }
    }

    return {
      name: name,
      type: getParameter('type', Object.keys(loaders), 'text'),
      stream: !!request.stream,
      credentials: !!request.credentials,
      src: getString('src', true, ''),
      parser: parser
    };
  }).map(function (request) {
    return (loaders[request.type])(request);
  });

  function abort(message) {
    if (state === STATE_ERROR || state === STATE_COMPLETE) {
      return;
    }
    state = STATE_ERROR;
    pending.forEach(function (loader) {
      loader.cancel();
    });
    if (onError) {
      if (typeof message === 'string') {
        onError(new Error('resl: ' + message));
      } else {
        onError(message);
      }
    } else {
      console.error('resl error:', message);
    }
  }

  function notifyProgress(message) {
    if (state === STATE_ERROR || state === STATE_COMPLETE) {
      return;
    }

    let progress = 0;
    let numReady = 0;
    pending.forEach(function (loader) {
      if (loader.ready) {
        numReady += 1;
      }
      progress += loader.progress;
    });

    if (numReady === pending.length) {
      state = STATE_COMPLETE;
      onDone(assets);
    } else {
      if (onProgress) {
        onProgress(progress / pending.length, message);
      }
    }
  }

  if (pending.length === 0) {
    setTimeout(function () {
      notifyProgress('done');
    }, 1);
  }
}

var builtinPrograms = {
  // ========================
  // diffuse
  // ========================

  diffuse: {
    attributes: [
      'a_position',
      'a_normal',
      'a_uv0'
    ],
    vertexShader: `
      precision mediump float;
      uniform mat4 model, view, projection;

      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec2 a_uv0;

      varying vec2 v_uv0;

      void main() {
        v_uv0 = a_uv0;
        gl_Position = projection * view * model * vec4(a_position, 1);
      }
    `,
    fragmentShader: `
      #extension GL_OES_standard_derivatives : enable

      precision mediump float;
      uniform sampler2D u_mainTexture;
      uniform vec2 u_mainTextureTiling;
      uniform vec2 u_mainTextureOffset;

      varying vec2 v_uv0;

      void main () {
        // gl_FragColor = vec4( 1, 1, 1, 1 );
        // gl_FragColor = vec4( v_uv0.x, v_uv0.y, 0, 1 );

        vec2 uv0 = v_uv0 * u_mainTextureTiling + u_mainTextureOffset;

        gl_FragColor = texture2D( u_mainTexture, uv0 );

        if (!gl_FrontFacing) {
          gl_FragColor *= 0.05;
        }
      }
    `,
  },

  // ========================
  // diffuse_skinning
  // ========================

  diffuse_skinning: {
    attributes: [
      'a_position',
      'a_normal',
      'a_uv0',
      'a_joint',
      'a_weight'
    ],
    vertexShader: `
      precision mediump float;
      uniform mat4 model, view, projection;

      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec2 a_uv0;
      attribute vec4 a_weight;
      attribute vec4 a_joint;

      uniform sampler2D u_bonesTexture;
      uniform float u_bonesTextureSize;

      varying vec2 v_uv0;

      mat4 getBoneMatrix(const in float i) {
        float size = u_bonesTextureSize;
        float j = i * 4.0;
        float x = mod(j, size);
        float y = floor(j / size);

        float dx = 1.0 / size;
        float dy = 1.0 / size;

        y = dy * (y + 0.5);

        vec4 v1 = texture2D(u_bonesTexture, vec2(dx * (x + 0.5), y));
        vec4 v2 = texture2D(u_bonesTexture, vec2(dx * (x + 1.5), y));
        vec4 v3 = texture2D(u_bonesTexture, vec2(dx * (x + 2.5), y));
        vec4 v4 = texture2D(u_bonesTexture, vec2(dx * (x + 3.5), y));

        mat4 bone = mat4(v1, v2, v3, v4);

        return bone;
      }

      void main() {
        v_uv0 = a_uv0;
        mat4 matSkin =
          getBoneMatrix(a_joint.x) * a_weight.x +
          getBoneMatrix(a_joint.y) * a_weight.y +
          getBoneMatrix(a_joint.z) * a_weight.z +
          getBoneMatrix(a_joint.w) * a_weight.w ;

        gl_Position = projection * view * model * matSkin * vec4(a_position, 1);
      }
    `,
    fragmentShader: `
      #extension GL_OES_standard_derivatives : enable

      precision mediump float;
      uniform sampler2D u_mainTexture;

      varying vec2 v_uv0;

      void main () {
        // gl_FragColor = vec4( 1, 1, 1, 1 );
        // gl_FragColor = vec4( v_uv0.x, v_uv0.y, 0, 1 );

        gl_FragColor = texture2D( u_mainTexture, v_uv0 );

        if (!gl_FrontFacing) {
          gl_FragColor *= 0.05;
        }
      }
    `,
  }
};

const GL = WebGLRenderingContext.prototype;

var builtinTechniques = {
  diffuse: {
    name: 'diffuse',
    program: 'diffuse',
    parameters: {
      position: {
        type: GL.FLOAT_VEC3,
        semantic: 'POSITION'
      },
      normal: {
        type: GL.FLOAT_VEC3,
        semantic: 'NORMAL'
      },
      uv0: {
        type: GL.FLOAT_VEC2,
        semantic: 'TEXCOORD_0'
      },
      model: {
        type: GL.FLOAT_MAT4,
        semantic: 'MODEL'
      },
      view: {
        type: GL.FLOAT_MAT4,
        semantic: 'VIEW'
      },
      projection: {
        type: GL.FLOAT_MAT4,
        semantic: 'PROJECTION'
      },
      mainTexture: {
        type: GL.SAMPLER_2D,
      },
      mainTextureTiling: {
        type: GL.FLOAT_VEC2,
      },
      mainTextureOffset: {
        type: GL.FLOAT_VEC2,
      },
    },

    attributes: {
      a_position: 'position',
      a_normal: 'normal',
      a_uv0: 'uv0',
    },

    uniforms: {
      model: 'model',
      // view: 'view',
      // projection: 'projection',
      u_mainTexture: 'mainTexture',
      u_mainTextureTiling: 'mainTextureTiling',
      u_mainTextureOffset: 'mainTextureOffset',
    },
  },

  diffuse_skinning: {
    name: 'diffuse_skinning',
    program: 'diffuse_skinning',
    parameters: {
      position: {
        type: GL.FLOAT_VEC3,
        semantic: 'POSITION'
      },
      normal: {
        type: GL.FLOAT_VEC3,
        semantic: 'NORMAL'
      },
      uv0: {
        type: GL.FLOAT_VEC2,
        semantic: 'TEXCOORD_0'
      },
      joint: {
        type: GL.FLOAT_VEC4,
        semantic: 'JOINT'
      },
      weight: {
        type: GL.FLOAT_VEC4,
        semantic: 'WEIGHT'
      },
      model: {
        type: GL.FLOAT_MAT4,
        semantic: 'MODEL'
      },
      view: {
        type: GL.FLOAT_MAT4,
        semantic: 'VIEW'
      },
      projection: {
        type: GL.FLOAT_MAT4,
        semantic: 'PROJECTION'
      },
      mainTexture: {
        type: GL.SAMPLER_2D,
      },
      bonesTexture: {
        type: GL.SAMPLER_2D,
      },
      bonesTextureSize: {
        type: GL.FLOAT,
      },
    },

    attributes: {
      a_position: 'position',
      a_normal: 'normal',
      a_uv0: 'uv0',
      a_joint: 'joint',
      a_weight: 'weight',
    },

    uniforms: {
      model: 'model',
      // view: 'view',
      // projection: 'projection',
      u_bonesTexture: 'bonesTexture',
      u_bonesTextureSize: 'bonesTextureSize',
      u_mainTexture: 'mainTexture',
    },
  },
};

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
    sceneGraph.utils.walk(node, child => {
      fn(child);
    });
  });
}

function _replace(scene, oldNode, newNode) {
  if (oldNode._parent) {
    return sceneGraph.utils.replace(oldNode, newNode);
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
    let node = new sceneGraph.Node(gltfNode.name);
    let data;

    node._id = nodeID;
    node._parent = parent;

    data = gltfNode.translation;
    node.lpos = data ?
      vmath.vec3.new(data[0], data[1], data[2]) :
      vmath.vec3.new(0, 0, 0)
      ;

    data = gltfNode.rotation;
    node.lrot = data ?
      vmath.quat.new(data[0], data[1], data[2], data[3]) :
      vmath.quat.new(0, 0, 0, 1)
      ;

    data = gltfNode.scale;
    node.lscale = data ?
      vmath.vec3.new(data[0], data[1], data[2]) :
      vmath.vec3.new(1, 1, 1)
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
  node = new sceneGraph.Node(gltfNode.name);

  node._id = id;
  node._parent = parent;

  let data;
  data = gltfNode.translation;
  node.lpos = data ?
    vmath.vec3.new(data[0], data[1], data[2]) :
    vmath.vec3.new(0, 0, 0)
    ;

  data = gltfNode.rotation;
  node.lrot = data ?
    vmath.quat.new(data[0], data[1], data[2], data[3]) :
    vmath.quat.new(0, 0, 0, 1)
    ;

  data = gltfNode.scale;
  node.lscale = data ?
    vmath.vec3.new(data[0], data[1], data[2]) :
    vmath.vec3.new(1, 1, 1)
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
        vmath.vec3.copy(prefabNode.lpos, child.lpos);
        vmath.vec3.copy(prefabNode.lscale, child.lscale);
        vmath.quat.copy(prefabNode.lrot, child.lrot);

        _replace(result, child, prefabNode);

        scene._dirty = true;
      }
    });
  });

  // done
  callback(null, result);
}

function load (regl, url, callback) {
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

const GL$1 = WebGLRenderingContext.prototype;
let m4_a = vmath.mat4.create();

function _type2buffersize(type) {
  if (type === 'SCALAR') {
    return 1;
  } else if (type === 'VEC2') {
    return 2;
  } else if (type === 'VEC3') {
    return 3;
  } else if (type === 'VEC4') {
    return 4;
  } else if (type === 'MAT2') {
    return 4;
  } else if (type === 'MAT3') {
    return 9;
  } else if (type === 'MAT4') {
    return 16;
  }

  return 1;
}

function _mode2primitive(mode) {
  if (mode === GL$1.POINTS) {
    return 'points';
  } else if (mode === GL$1.LINES) {
    return 'lines';
  } else if (mode === GL$1.LINE_LOOP) {
    return 'line loop';
  } else if (mode === GL$1.LINE_STRIP) {
    return 'line strip';
  } else if (mode === GL$1.TRIANGLES) {
    return 'triangles';
  } else if (mode === GL$1.TRIANGLE_STRIP) {
    return 'triangle strip';
  } else if (mode === GL$1.TRIANGLE_FAN) {
    return 'triangle fan';
  }

  return 'triangles';
}

function buildCommandData(scene, node, gltfPrimitive) {
  // get material & technique
  let gltfMaterial = scene.materials[gltfPrimitive.material];
  // let techID = useSkin ? gltfMaterial.technique + '_skinning' : gltfMaterial.technique;
  let techID = gltfMaterial.technique;
  let tech = scene.techniques[techID];
  let program = scene.programs[tech.program];

  let data = {
    techID: techID,
    primitive: _mode2primitive(gltfPrimitive.mode),
    attributes: {},
    uniforms: {},
  };

  // get attribute accessor
  program.attributes.forEach(attrName => {
    let paramName = tech.attributes[attrName];
    let param = tech.parameters[paramName];
    let accessorID = gltfPrimitive.attributes[param.semantic];
    if (!accessorID) {
      console.warn(`can not find attribute by semantic ${param.semantic}`);
      return;
    }

    let accessor = scene.accessors[accessorID];
    data.attributes[attrName] = {
      buffer: scene.buffers[accessor.bufferView],
      offset: accessor.byteOffset,
      stride: accessor.byteStride,
      // type: _type2buffertype(accessor.componentType),
      type: accessor.componentType,
      size: _type2buffersize(accessor.type),
    };
  });

  // get uniforms
  for (let name in tech.uniforms) {
    let paramName = tech.uniforms[name];
    let param = tech.parameters[paramName];

    let value = gltfMaterial.values[paramName];
    if (value !== undefined) {
      if (param.type === GL$1.SAMPLER_2D) {
        data.uniforms[name] = scene.textures[value];
      } else {
        data.uniforms[name] = value;
      }
      continue;
    }

    // use default value
    if (param.value !== undefined) {
      if (param.type === GL$1.SAMPLER_2D) {
        data.uniforms[name] = scene.textures[param.value];
      } else {
        data.uniforms[name] = value;
      }
    }
  }

  // get indices accessor
  if (gltfPrimitive.indices) {
    let accessor = scene.accessors[gltfPrimitive.indices];
    data.elements = scene.buffers[accessor.bufferView];
    data.offset = accessor.byteOffset;
    data.count = accessor.count;
  }

  // TODO: states

  // node uniforms
  node.getWorldMatrix(m4_a);
  data.uniforms.model = vmath.mat4.array(f32a_m4_pool.alloc(), m4_a);

  // if (bonesTexture) {
  //   info.uniforms.u_bonesTexture = bonesTexture;
  //   info.uniforms.u_bonesTextureSize = bonesTexture.width;
  // }

  return data;
}

function reset() {
  f32a_m4_pool.reset();
}

exports.reset = reset;
exports.load = load;
exports.buildCommandData = buildCommandData;

}((this.regltf = this.regltf || {}),window.memop,window.sgraph,window.vmath));
//# sourceMappingURL=regltf.dev.js.map
