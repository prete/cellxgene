import styles from './parallelCoordinates.css';
import renderQueue from "./renderQueue";
import {
  margin,
  width,
  height,
  innerHeight,
  color,
  dimensions,
  types,
  xscale,
  yAxis,
} from "./util";

/*****************************************
******************************************
Canvas Parallel coordinates with svg brushing via /* via https://bl.ocks.org/syntagmatic/05a5b0897a48890133beb59c815bd953
******************************************
******************************************/

const drawParallelCoordinates = (data) => {

  const d3_functor = (v) => {
    return typeof v === "function" ? v : function() { return v; };
  };

  /*****************************************
  ******************************************
        Setup SVG & Canvas elements
  ******************************************
  ******************************************/

  var container = d3.select("#parcoords")

  var svg = container.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var canvas = container.append("canvas")
      .attr("width", width * devicePixelRatio)
      .attr("height", height * devicePixelRatio)
      .style("width", width + "px")
      .style("height", height + "px")
      .style("margin-top", margin.top + "px")
      .style("margin-left", margin.left + "px");


  var ctx = canvas.node().getContext("2d");
      ctx.globalCompositeOperation = 'darken';
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1.5;
      ctx.scale(devicePixelRatio, devicePixelRatio);

  var output = d3.select("#parcoords_output");

  var axes = svg.selectAll(".parcoords_axis")
      .data(dimensions)
    .enter().append("g")
      .attr("class", `${styles.axis} parcoords_axis`)
      .attr("transform", function(d,i) { return "translate(" + xscale(i) + ")"; });

  /*****************************************
  ******************************************
      process data and extract features
  ******************************************
  ******************************************/

    // shuffle the data! - or not, this is a visual effect
    data = d3.shuffle(data);

    data.forEach(function(d) {
      dimensions.forEach(function(p) {
        d[p.key] = !d[p.key] ? null : p.type.coerce(d[p.key]);
      });

      // truncate long text strings to fit in data table
      for (var key in d) {
        if (d[key] && d[key].length > 35) d[key] = d[key].slice(0,36);
      }
    });

    // type/dimension default setting happens here
    dimensions.forEach(function(dim) {
      if (!("domain" in dim)) {
        // detect domain using dimension type's extent function
        dim.domain = d3_functor(dim.type.extent)(data.map(function(d) { return d[dim.key]; }));
      }
      if (!("scale" in dim)) {
        // use type's default scale for dimension
        dim.scale = dim.type.defaultScale.copy();
      }
      dim.scale.domain(dim.domain);
    });

    const draw = (d) => {

      /*

      line color options from cell metadata 8/23/2017:

      Cluster_2d_color
      Cluster_CNV_color
      Location.color
      Sample.name.color
      Sample.type.color
      Selection.color
      housekeeping_cluster_color
      recluster_myeloid
      recluster_myeloid_color

      */

      ctx.strokeStyle = d["Sample.name.color"];
      // ctx.strokeStyle = "rgba(180,180,180,.4)";
      ctx.beginPath();
      var coords = project(d);
      coords.forEach((p,i) => {
        // this tricky bit avoids rendering null values as 0
        if (p === null) {
          // this bit renders horizontal lines on the previous/next
          // dimensions, so that sandwiched null values are visible
          if (i > 0) {
            var prev = coords[i-1];
            if (prev !== null) {
              ctx.moveTo(prev[0],prev[1]);
              ctx.lineTo(prev[0]+6,prev[1]);
            }
          }
          if (i < coords.length-1) {
            var next = coords[i+1];
            if (next !== null) {
              ctx.moveTo(next[0]-6,next[1]);
            }
          }
          return;
        }

        if (i == 0) {
          ctx.moveTo(p[0],p[1]);
          return;
        }

        ctx.lineTo(p[0],p[1]);
      });
      ctx.stroke();
    }

    /*****************************************
    ******************************************
    Handles a brush event, toggling the display of foreground lines.
    ******************************************
    ******************************************/

    function brush () {
      render.invalidate();

      var actives = [];
      svg.selectAll(".parcoords_axis .parcoords_brush")
        .filter(function (d) {
          return d3.brushSelection(this);
        })
        .each(function(d) {
          actives.push({
            dimension: d,
            extent: d3.brushSelection(this)
          });
        });

      var selected = data.filter(function(d) {
        /* this is iterating over the enter dataset */
        if (actives.every(function(active) {
            var dim = active.dimension;
            // test if point is within extents for each active brush
            return dim.type.within(d[dim.key], active.extent, dim);
          })) {
          return true;
        }
      });

      /* Reset canvas */
      ctx.clearRect(0,0,width,height);
      ctx.globalAlpha = d3.min([0.85/Math.pow(selected.length,0.3),1]);

      /* pass the result of the filter above to a fresh canvas, using RAF */
      render(selected);

      output.text(d3.tsvFormat(selected.slice(0,22)));
    }

    function brushstart() {
      d3.event.sourceEvent.stopPropagation();
    }


    /*****************************************
    ******************************************
                    Render
    ******************************************
    ******************************************/

    var render = renderQueue(draw).rate(50);

    ctx.clearRect(0,0,width,height);
    ctx.globalAlpha = d3.min([0.85/Math.pow(data.length,0.3),1]);

    render(data);

    axes.append("g")
        .each(function(d) {
          var renderAxis = "axis" in d
            ? d.axis.scale(d.scale)  // custom axis
            : yAxis.scale(d.scale);  // default axis
          d3.select(this).call(renderAxis);
        })
      .append("text")
        .attr("class", styles.title)
        .attr("text-anchor", "start")
        .text(function(d) { return "description" in d ? d.description : d.key; });

    // Add and store a brush for each axis.
    axes.append("g")
        .attr("class", `${styles.brush} parcoords_brush`)
        .each(function(d) {
          d3.select(this).call(d.brush = d3.brushY()
            .extent([[-10,0], [10,height]])
            .on("start", brushstart)
            .on("brush", brush)
            .on("end", brush)
          )
        })
      .selectAll("rect")
        .attr("x", -8)
        .attr("width", 16);

    output.text(d3.tsvFormat(data.slice(0,22)));

    function project(d) {
      return dimensions.map(function(p,i) {
        // check if data element has property and contains a value
        if (
          !(p.key in d) ||
          d[p.key] === null
        ) return null;

        return [xscale(i),p.scale(d[p.key])];
      });
    };

}

export default drawParallelCoordinates;