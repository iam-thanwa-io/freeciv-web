/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://play.freeciv.org/
    Copyright (C) 2009-2016  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

var container;
var camera, scene, maprenderer;
var plane, cube;
var mouse, raycaster, isShiftDown = false;

var rollOverMesh, rollOverMaterial;
var cubeGeo, cubeMaterial;

var objects = [];


/****************************************************************************
  Init the Freeciv-web WebGL renderer
****************************************************************************/
function init_webgl_renderer()
{
  // load Three.js dynamically.
  $.ajax({
    async: false,
    url: "/javascript/libs/three.min.js",
    dataType: "script"
  });

  $.ajax({
    async: false,
    url: "/javascript/libs/Detector.js",
    dataType: "script"
  });

  if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

  /* Loads the two tileset definition files */
  $.ajax({
    url: "/javascript/2dcanvas/tileset_config_amplio2.js",
    dataType: "script",
    async: false
  }).fail(function() {
    console.error("Unable to load tileset config.");
  });

  $.ajax({
    url: "/javascript/2dcanvas/tileset_spec_amplio2.js",
    dataType: "script",
    async: false
  }).fail(function() {
    console.error("Unable to load tileset spec. Run Freeciv-img-extract.");
  });

  init_sprites();


}


/****************************************************************************
  Start the Freeciv-web WebGL renderer
****************************************************************************/
function webgl_start_renderer()
{
  container = document.getElementById('canvas_div');

  camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 10000 );
  camera.position.set( 800, 1000, 1200 );
  camera.lookAt( new THREE.Vector3(600, 0, 900) );

  scene = new THREE.Scene();

  // roll-over helpers

  rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
  rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
  rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
  scene.add( rollOverMesh );

    // cubes

  cubeGeo = new THREE.BoxGeometry( 50, 50, 50 );
  cubeMaterial = new THREE.MeshLambertMaterial( { color: 0xfeb74c, map: new THREE.TextureLoader().load( "/textures/square-outline-textured.png" ) } );

  // grid

  var step = 50;
  var size = step * (map['xsize'] / 2);

  var geometry = new THREE.Geometry();

  for ( var i = 0; i <= size; i += step ) {

    geometry.vertices.push( new THREE.Vector3( 0, 0, i ) );
    geometry.vertices.push( new THREE.Vector3(   size, 0, i ) );

    geometry.vertices.push( new THREE.Vector3( i, 0, 0 ) );
    geometry.vertices.push( new THREE.Vector3( i, 0,   size ) );

  }

  var material = new THREE.LineBasicMaterial( { color: 0x000000, opacity: 0.2, transparent: true } );

  var line = new THREE.LineSegments( geometry, material );
  scene.add( line );

  //

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  var geometry = new THREE.PlaneBufferGeometry( 1000, 1000 );
  geometry.rotateX( - Math.PI / 2 );

  plane = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { visible: false } ) );
  scene.add( plane );

  objects.push( plane );

  // Lights

  var ambientLight = new THREE.AmbientLight( 0x606060 );
  scene.add( ambientLight );

  var directionalLight = new THREE.DirectionalLight( 0xffffff );
  directionalLight.position.set( 1, 0.75, 0.5 ).normalize();
  scene.add( directionalLight );

  maprenderer = new THREE.WebGLRenderer( { antialias: true } );
  maprenderer.setClearColor( 0xf0f0f0 );
  maprenderer.setPixelRatio( window.devicePixelRatio );
  maprenderer.setSize( window.innerWidth, window.innerHeight );
  container.appendChild( maprenderer.domElement );

  document.addEventListener( 'mousemove', webglOnDocumentMouseMove, false );
  document.addEventListener( 'mousedown', webglOnDocumentMouseDown, false );
  document.addEventListener( 'keydown', webglOnDocumentKeyDown, false );
  document.addEventListener( 'keyup', webglOnDocumentKeyUp, false );
  window.addEventListener( 'resize', webglOnWindowResize, false );

  animate();

  send_message_delayed("/observe", 200);
  setTimeout(render_testmap, 1000);




}


/****************************************************************************
...
****************************************************************************/
function generateTexture( width, height, color ) {

    var canvas, context, image, imageData,
    level, diff, vector3, sun, shade;

    vector3 = new THREE.Vector3( 0, 0, 0 );

    sun = new THREE.Vector3( 1, 1, 1 );
    sun.normalize();

    canvas = document.createElement( 'canvas' );
    canvas.width = width;
    canvas.height = height;

    context = canvas.getContext( '2d' );
    context.fillStyle = color;
    context.fillRect( 0, 0, width, height );
    return canvas;

}




/****************************************************************************
...
****************************************************************************/
function render_testmap() {

    var texture = new THREE.CanvasTexture( generateTexture( 1024, 1024 , '#00a') );
    var material = new THREE.MeshBasicMaterial( { map: texture, overdraw: 0.5 } );

    var quality = 16, step = 1024 / quality;

    var geometry = new THREE.PlaneGeometry( 2000, 2000, quality - 1, quality - 1 );
    geometry.rotateX( - Math.PI / 2 );
    geometry.translate(1000, 0, 1000);

    for ( var i = 0, l = geometry.vertices.length; i < l; i ++ ) {

        var x = i % quality, y = Math.floor( i / quality );
        geometry.vertices[ i ].y = 50;

    }

    mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );


    var landMaterial = new THREE.MeshBasicMaterial( { map: new THREE.TextureLoader().load( "/textures/grasslight-big.jpg" ), overdraw: 0.5 } );

    var quality = map['xsize'], step = 1024 / quality;

    var landGeometry = new THREE.PlaneGeometry( 2000, 2000, quality - 1, quality - 1 );
    landGeometry.rotateX( - Math.PI / 2 );
    landGeometry.translate(1000, 0, 1000);

    for ( var i = 0, l = landGeometry.vertices.length; i < l; i ++ ) {

        var x = i % quality, y = Math.floor( i / quality );
        var ptile = map_pos_to_tile(Math.floor(map['xsize']*x/quality), Math.floor(map['ysize']*y/quality));
        if (ptile != null) {
          landGeometry.vertices[ i ].y = !is_ocean_tile(ptile) ? 100 : -300;
        }

    }

    landMesh = new THREE.Mesh( landGeometry, landMaterial );
    scene.add( landMesh );


/*  for (var x = 0; x < map['xsize']; x++) {
    for (var y = 0; y < map['ysize']; y++) {
      var ptile = map_pos_to_tile(x, y);
      if (!is_ocean_tile(ptile)) {
        var voxel = new THREE.Mesh( cubeGeo, cubeMaterial );
        voxel.position.set( x*50, 0, y*50 );
        scene.add( voxel );
        objects.push( voxel );
      }
    }
  }*/
}

/****************************************************************************
...
****************************************************************************/
function animate() {
  maprenderer.render( scene, camera );
  requestAnimationFrame( animate );

}


