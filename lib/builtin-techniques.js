const GL = WebGLRenderingContext.prototype;

export default {
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