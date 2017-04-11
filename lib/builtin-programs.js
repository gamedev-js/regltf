export default {
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