export default function drawSpatialImageRegl(regl) {
  return regl({
    frag: `
      precision mediump float;
      uniform sampler2D texture;
      varying vec2 uv;
      void main () {
        gl_FragColor = texture2D(texture, uv);
      }`,

    vert: `
      precision mediump float;
      attribute vec2 position;
      varying vec2 uv;
      uniform mat3 projView;
      uniform vec2 scale;
      vec2 norm(vec2 position) {
        return ((position - 0.5) * 2.0) * scale;
      }
      void main() {
        uv = position;
        vec3 xy = projView * vec3(norm(position), 1.);
        gl_Position = vec4(xy.xy, 0, 1.);
      }`,

    attributes: {
      /*
       * Position are the 6 vertices required to draw two triangles:
       *  - 6 positions are the 3 vertices of triangle A
       *  - 6 positions are the 3 vertices of triangle B.
       * The spatial image will be the texture of those two triangles.
       *
       *  (-1, 1)   _________  (1, 1)
       *           |\        | 
       *           |  \   B  |  
       *           |    \    |  
       *           |  A   \  |
       *  (-1, -1) |________\|   (1, -1)
       */
      position: [
        //Triangle A-------------
        -1, 1,
        -1, -1,
        1, -1,
        //Triangle B-------------
        1, -1,
        1, 1,
        -1, 1 
      ],
    },

    uniforms: {
      //distance: regl.prop("distance"),
      //minViewportDimension: regl.prop("minViewportDimension"),
      scale: regl.prop("scale"),
      //offset: regl.prop("offset"),
      projView: regl.prop("projView"),
      texture: regl.prop("spatialImageAsTexture"),
    },

    count: 6,

  });
}
