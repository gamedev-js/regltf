import {mat4} from 'vmath';

const GL = WebGLRenderingContext.prototype;
let m4_a = mat4.create();
let array_m4 = new Float32Array(16);

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
  if (mode === GL.POINTS) {
    return 'points';
  } else if (mode === GL.LINES) {
    return 'lines';
  } else if (mode === GL.LINE_LOOP) {
    return 'line loop';
  } else if (mode === GL.LINE_STRIP) {
    return 'line strip';
  } else if (mode === GL.TRIANGLES) {
    return 'triangles';
  } else if (mode === GL.TRIANGLE_STRIP) {
    return 'triangle strip';
  } else if (mode === GL.TRIANGLE_FAN) {
    return 'triangle fan';
  }

  return 'triangles';
}

export default function buildCommandData(scene, node, gltfPrimitive) {
  let json = scene.json;

  // get material & technique
  let gltfMaterial = json.materials[gltfPrimitive.material];
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

    let accessor = json.accessors[accessorID];
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
      if (param.type === GL.SAMPLER_2D) {
        data.uniforms[name] = scene.textures[value];
      } else {
        data.uniforms[name] = value;
      }
      continue;
    }

    // use default value
    if (param.value !== undefined) {
      if (param.type === GL.SAMPLER_2D) {
        data.uniforms[name] = scene.textures[param.value];
      } else {
        data.uniforms[name] = value;
      }
    }
  }

  // get indices accessor
  if (gltfPrimitive.indices) {
    let accessor = json.accessors[gltfPrimitive.indices];
    data.elements = scene.buffers[accessor.bufferView];
    data.offset = accessor.byteOffset;
    data.count = accessor.count;
  }

  // TODO: states

  // node uniforms
  node.getWorldMatrix(m4_a);

  let arr = new Float32Array(16);
  mat4.array(arr, m4_a);
  data.uniforms.model = arr;

  // if (bonesTexture) {
  //   info.uniforms.u_bonesTexture = bonesTexture;
  //   info.uniforms.u_bonesTextureSize = bonesTexture.width;
  // }

  return data;
}