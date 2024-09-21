(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = {
  vertex: "precision mediump float;\n\nattribute vec2 aPosition;\nattribute vec2 aLumaPosition;\nattribute vec2 aChromaPosition;\nvarying vec2 vLumaPosition;\nvarying vec2 vChromaPosition;\nvoid main() {\n    gl_Position = vec4(aPosition, 0, 1);\n    vLumaPosition = aLumaPosition;\n    vChromaPosition = aChromaPosition;\n}\n",
  fragment: "// inspired by https://github.com/mbebenita/Broadway/blob/master/Player/canvas.js\n\nprecision mediump float;\n\nuniform sampler2D uTextureY;\nuniform sampler2D uTextureCb;\nuniform sampler2D uTextureCr;\nvarying vec2 vLumaPosition;\nvarying vec2 vChromaPosition;\nvoid main() {\n   // Y, Cb, and Cr planes are uploaded as ALPHA textures.\n   float fY = texture2D(uTextureY, vLumaPosition).w;\n   float fCb = texture2D(uTextureCb, vChromaPosition).w;\n   float fCr = texture2D(uTextureCr, vChromaPosition).w;\n\n   // Premultipy the Y...\n   float fYmul = fY * 1.1643828125;\n\n   // And convert that to RGB!\n   gl_FragColor = vec4(\n     fYmul + 1.59602734375 * fCr - 0.87078515625,\n     fYmul - 0.39176171875 * fCb - 0.81296875 * fCr + 0.52959375,\n     fYmul + 2.017234375   * fCb - 1.081390625,\n     1\n   );\n}\n",
  vertexStripe: "precision mediump float;\n\nattribute vec2 aPosition;\nattribute vec2 aTexturePosition;\nvarying vec2 vTexturePosition;\n\nvoid main() {\n    gl_Position = vec4(aPosition, 0, 1);\n    vTexturePosition = aTexturePosition;\n}\n",
  fragmentStripe: "// extra 'stripe' texture fiddling to work around IE 11's poor performance on gl.LUMINANCE and gl.ALPHA textures\n\nprecision mediump float;\n\nuniform sampler2D uStripe;\nuniform sampler2D uTexture;\nvarying vec2 vTexturePosition;\nvoid main() {\n   // Y, Cb, and Cr planes are mapped into a pseudo-RGBA texture\n   // so we can upload them without expanding the bytes on IE 11\n   // which doesn't allow LUMINANCE or ALPHA textures\n   // The stripe textures mark which channel to keep for each pixel.\n   // Each texture extraction will contain the relevant value in one\n   // channel only.\n\n   float fLuminance = dot(\n      texture2D(uStripe, vTexturePosition),\n      texture2D(uTexture, vTexturePosition)\n   );\n\n   gl_FragColor = vec4(0, 0, 0, fLuminance);\n}\n"
};

},{}],2:[function(require,module,exports){
/*
Copyright (c) 2014-2016 Brion Vibber <brion@pobox.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
MPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
ONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * Represents metadata about a YUV frame format.
 * @typedef {Object} YUVFormat
 * @property {number} width - width of encoded frame in luma pixels
 * @property {number} height - height of encoded frame in luma pixels
 * @property {number} chromaWidth - width of encoded frame in chroma pixels
 * @property {number} chromaHeight - height of encoded frame in chroma pixels
 * @property {number} cropLeft - upper-left X coordinate of visible crop region, in luma pixels
 * @property {number} cropTop - upper-left Y coordinate of visible crop region, in luma pixels
 * @property {number} cropWidth - width of visible crop region, in luma pixels
 * @property {number} cropHeight - height of visible crop region, in luma pixels
 * @property {number} displayWidth - final display width of visible region, in luma pixels
 * @property {number} displayHeight - final display height of visible region, in luma pixels
 */

/**
 * Represents underlying image data for a single luma or chroma plane.
 * Cannot be interpreted without the format data from a frame buffer.
 * @typedef {Object} YUVPlane
 * @property {Uint8Array} bytes - typed array containing image data bytes
 * @property {number} stride - byte distance between rows in data
 */

/**
 * Represents a YUV image frame buffer, with enough format information
 * to interpret the data usefully. Buffer objects use generic objects
 * under the hood and can be transferred between worker threads using
 * the structured clone algorithm.
 *
 * @typedef {Object} YUVFrame
 * @property {YUVFormat} format
 * @property {YUVPlane} y
 * @property {YUVPlane} u
 * @property {YUVPlane} v
 */

/**
 * Holder namespace for utility functions and constants related to
 * YUV frame and plane buffers.
 *
 * @namespace
 */
var YUVBuffer = {
  /**
   * Validate a plane dimension
   * @param {number} dim - vertical or horizontal dimension
   * @throws exception on zero, negative, or non-integer value
   */
  validateDimension: function(dim) {
    if (dim <= 0 || dim !== (dim | 0)) {
      throw 'YUV plane dimensions must be a positive integer';
    }
  },

  /**
   * Validate a plane offset
   * @param {number} dim - vertical or horizontal dimension
   * @throws exception on negative or non-integer value
   */
  validateOffset: function(dim) {
    if (dim < 0 || dim !== (dim | 0)) {
      throw 'YUV plane offsets must be a non-negative integer';
    }
  },

  /**
   * Validate and fill out a YUVFormat object structure.
   *
   * At least width and height fields are required; other fields will be
   * derived if left missing or empty:
   * - chromaWidth and chromaHeight will be copied from width and height as for a 4:4:4 layout
   * - cropLeft and cropTop will be 0
   * - cropWidth and cropHeight will be set to whatever of the frame is visible after cropTop and cropLeft are applied
   * - displayWidth and displayHeight will be set to cropWidth and cropHeight.
   *
   * @param {YUVFormat} fields - input fields, must include width and height.
   * @returns {YUVFormat} - validated structure, with all derivable fields filled out.
   * @throws exception on invalid fields or missing width/height
   */
  format: function(fields) {
    var width = fields.width,
      height = fields.height,
      chromaWidth = fields.chromaWidth || width,
      chromaHeight = fields.chromaHeight || height,
      cropLeft = fields.cropLeft || 0,
      cropTop = fields.cropTop || 0,
      cropWidth = fields.cropWidth || width - cropLeft,
      cropHeight = fields.cropHeight || height - cropTop,
      displayWidth = fields.displayWidth || cropWidth,
      displayHeight = fields.displayHeight || cropHeight;
    this.validateDimension(width);
    this.validateDimension(height);
    this.validateDimension(chromaWidth);
    this.validateDimension(chromaHeight);
    this.validateOffset(cropLeft);
    this.validateOffset(cropTop);
    this.validateDimension(cropWidth);
    this.validateDimension(cropHeight);
    this.validateDimension(displayWidth);
    this.validateDimension(displayHeight);
    return {
      width: width,
      height: height,
      chromaWidth: chromaWidth,
      chromaHeight: chromaHeight,
      cropLeft: cropLeft,
      cropTop: cropTop,
      cropWidth: cropWidth,
      cropHeight: cropHeight,
      displayWidth: displayWidth,
      displayHeight: displayHeight
    };
  },

  /**
   * Allocate a new YUVPlane object of the given size.
   * @param {number} stride - byte distance between rows
   * @param {number} rows - number of rows to allocate
   * @returns {YUVPlane} - freshly allocated planar buffer
   */
  allocPlane: function(stride, rows) {
    YUVBuffer.validateDimension(stride);
    YUVBuffer.validateDimension(rows);
    return {
      bytes: new Uint8Array(stride * rows),
      stride: stride
    }
  },

  /**
   * Pick a suitable stride for a custom-allocated thingy
   * @param {number} width - width in bytes
   * @returns {number} - new width in bytes at least as large
   * @throws exception on invalid input width
   */
  suitableStride: function(width) {
    YUVBuffer.validateDimension(width);
    var alignment = 4,
      remainder = width % alignment;
    if (remainder == 0) {
      return width;
    } else {
      return width + (alignment - remainder);
    }
  },

  /**
   * Allocate or extract a YUVPlane object from given dimensions/source.
   * @param {number} width - width in pixels
   * @param {number} height - height in pixels
   * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
   * @param {number} stride - row length in bytes; optional (will create a default if missing)
   * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
   * @returns {YUVPlane} - freshly allocated planar buffer
   */
  allocPlane: function(width, height, source, stride, offset) {
    var size, bytes;

    this.validateDimension(width);
    this.validateDimension(height);

    offset = offset || 0;

    stride = stride || this.suitableStride(width);
    this.validateDimension(stride);
    if (stride < width) {
      throw "Invalid input stride for YUV plane; must be larger than width";
    }

    size = stride * height;

    if (source) {
      if (source.length - offset < size) {
        throw "Invalid input buffer for YUV plane; must be large enough for stride times height";
      }
      bytes = source.slice(offset, offset + size);
    } else {
      bytes = new Uint8Array(size);
      stride = stride || this.suitableStride(width);
    }

    return {
      bytes: bytes,
      stride: stride
    };
  },

  /**
   * Allocate a new YUVPlane object big enough for a luma plane in the given format
   * @param {YUVFormat} format - target frame format
   * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
   * @param {number} stride - row length in bytes; optional (will create a default if missing)
   * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
   * @returns {YUVPlane} - freshly allocated planar buffer
   */
  lumaPlane: function(format, source, stride, offset) {
    return this.allocPlane(format.width, format.height, source, stride, offset);
  },

  /**
   * Allocate a new YUVPlane object big enough for a chroma plane in the given format,
   * optionally copying data from an existing buffer.
   *
   * @param {YUVFormat} format - target frame format
   * @param {Uint8Array} source - input byte array; optional (will create empty buffer if missing)
   * @param {number} stride - row length in bytes; optional (will create a default if missing)
   * @param {number} offset - offset into source array to extract; optional (will start at 0 if missing)
   * @returns {YUVPlane} - freshly allocated planar buffer
   */
  chromaPlane: function(format, source, stride, offset) {
    return this.allocPlane(format.chromaWidth, format.chromaHeight, source, stride, offset);
  },

  /**
   * Allocate a new YUVFrame object big enough for the given format
   * @param {YUVFormat} format - target frame format
   * @param {YUVPlane} y - optional Y plane; if missing, fresh one will be allocated
   * @param {YUVPlane} u - optional U plane; if missing, fresh one will be allocated
   * @param {YUVPlane} v - optional V plane; if missing, fresh one will be allocated
   * @returns {YUVFrame} - freshly allocated frame buffer
   */
  frame: function(format, y, u, v) {
    y = y || this.lumaPlane(format);
    u = u || this.chromaPlane(format);
    v = v || this.chromaPlane(format);
    return {
      format: format,
      y: y,
      u: u,
      v: v
    }
  },

  /**
   * Duplicate a plane using new buffer memory.
   * @param {YUVPlane} plane - input plane to copy
   * @returns {YUVPlane} - freshly allocated and filled planar buffer
   */
  copyPlane: function(plane) {
    return {
      bytes: plane.bytes.slice(),
      stride: plane.stride
    };
  },

  /**
   * Duplicate a frame using new buffer memory.
   * @param {YUVFrame} frame - input frame to copyFrame
   * @returns {YUVFrame} - freshly allocated and filled frame buffer
   */
  copyFrame: function(frame) {
    return {
      format: frame.format,
      y: this.copyPlane(frame.y),
      u: this.copyPlane(frame.u),
      v: this.copyPlane(frame.v)
    }
  },

  /**
   * List the backing buffers for the frame's planes for transfer between
   * threads via Worker.postMessage.
   * @param {YUVFrame} frame - input frame
   * @returns {Array} - list of transferable objects
   */
  transferables: function(frame) {
    return [frame.y.bytes.buffer, frame.u.bytes.buffer, frame.v.bytes.buffer];
  }
};

module.exports = YUVBuffer;

},{}],3:[function(require,module,exports){
const playerStateIdle           = 0;
const playerStatePlaying        = 1;
const playerStatePausing        = 2;


(function() {
  "use strict";

  var defaultProtos = {
    http: {
      url: "http://roblin.cn/wasm/video/h265_high.mp4",
      waitLength : 512 * 1024,
      stream: false,
    },
    ws: {
      url: "ws://roblin.cn/wss/h265_high.mp4",
      waitLength : 512 * 1024,
      stream: false,
    },
    httpFlv: {
      url: "https://data.vod.itc.cn/bee/qf/wasm?tok=e4da89d923e4e2af4d622a0edb717f88827b422a&format=flv&direct=1",
      waitLength : 1 * 1024,
      stream: true,
    }
  };
  let inputUrl = document.getElementById("inputUrl");
  inputUrl.value = defaultProtos["httpFlv"]["url"];

  //Player object.
  self.player = new Player();

  var loadingDiv = document.getElementById("loading");
  self.player.setLoadingDiv(loadingDiv);

  //Formated logger.
  var logger = new Logger("Page");

  function playVideo() {
    var protoList = document.getElementById("protocol");
    var proto = protoList.options[protoList.selectedIndex].value;
    var protoObj = defaultProtos[proto];
    var inputUrl = document.getElementById("inputUrl");
    var url = inputUrl.value;

    var el = document.getElementById("btnPlayVideo");
    var currentState = self.player.getState();
    if (currentState == playerStatePlaying) {
      el.src = "img/play.png";
    } else {
      el.src = "img/pause.png";
    }

    if (currentState != playerStatePlaying) {
      const canvasId = "playCanvas";
      var canvas = document.getElementById(canvasId);
      if (!canvas) {
        logger.logError("No Canvas with id " + canvasId + "!");
        return false;
      }

      self.player.play(url, canvas, function (e) {
        console.log("play error " + e.error + " status " + e.status + ".");
        if (e.error == 1) {
          logger.logInfo("Finished.");
        }
      }, protoObj.waitLength, protoObj.stream);

      var timeTrack = document.getElementById("timeTrack");
      var timeLabel = document.getElementById("timeLabel");
      self.player.setTrack(timeTrack, timeLabel);
    } else {
      self.player.pause();
    }

    return true;
  }

  function stopVideo() {
    self.player.stop();
    var button = document.getElementById("btnPlayVideo");
    button.value = "Play";
    button.src = "img/play.png";
  }

  function fullscreen() {
    self.player.fullscreen();
  }

  function onSelectProto() {
    var protoList = document.getElementById("protocol");
    var proto = protoList.options[protoList.selectedIndex].value;
    var protoObj = defaultProtos[proto];
    var inputUrl = document.getElementById("inputUrl");
    inputUrl.value = protoObj["url"];
  }

  window.playVideo = playVideo;
  window.stopVideo = stopVideo;
  window.fullscreen = fullscreen;
  window.onSelectProto = onSelectProto;
})();

},{}],4:[function(require,module,exports){
//Decoder states.
const decoderStateIdle          = 0;
const decoderStateInitializing  = 1;
const decoderStateReady         = 2;
const decoderStateFinished      = 3;

//Player states.
const playerStateIdle           = 0;
const playerStatePlaying        = 1;
const playerStatePausing        = 2;

//Constant.
const maxBufferTimeLength       = 1.0;
const downloadSpeedByteRateCoef = 2.0;
var YUVBuffer = require('yuv-buffer'),
  YUVCanvas = require('./../src/yuv-canvas.js');

var canvas = document.querySelector('canvas'),
  yuvCanvas = YUVCanvas.attach(canvas, {webGL: true}),
  format = null,
  yuvFrame = null;

function setupFrame() {
  format = YUVBuffer.format({
    width: 1080,
    height: 1920,
    chromaWidth: 1080 / 2,
    chromaHeight: 1920 / 2
  });
  yuvFrame = YUVBuffer.frame(format);
}

String.prototype.startWith = function(str) {
    var reg = new RegExp("^" + str);
    return reg.test(this);
};

function FileInfo(url) {
    this.url = url;
    this.size = 0;
    this.offset = 0;
    this.chunkSize = 65536;
}

function Player() {
    this.fileInfo           = null;
    this.pcmPlayer          = null;
    this.canvas             = null;
    this.callback           = null;
    this.waitHeaderLength   = 524288;
    this.duration           = 0;
    this.pixFmt             = 0;
    this.videoWidth         = 0;
    this.videoHeight        = 0;
    this.yLength            = 0;
    this.uvLength           = 0;
    this.beginTimeOffset    = 0;
    this.decoderState       = decoderStateIdle;
    this.playerState        = playerStateIdle;
    this.decoding           = false;
    this.decodeInterval     = 5;
    this.videoRendererTimer = null;
    this.downloadTimer      = null;
    this.chunkInterval      = 200;
    this.downloadSeqNo      = 0;
    this.downloading        = false;
    this.downloadProto      = kProtoHttp;
    this.timeLabel          = null;
    this.timeTrack          = null;
    this.trackTimer         = null;
    this.trackTimerInterval = 500;
    this.displayDuration    = "00:00:00";
    this.audioEncoding      = "";
    this.audioChannels      = 0;
    this.audioSampleRate    = 0;
    this.seeking            = false;  // Flag to preventing multi seek from track.
    this.justSeeked         = false;  // Flag to preventing multi seek from ffmpeg.
    this.urgent             = false;
    this.seekWaitLen        = 524288; // Default wait for 512K, will be updated in onVideoParam.
    this.seekReceivedLen    = 0;
    this.loadingDiv         = null;
    this.buffering          = false;
    this.frameBuffer        = [];
    this.isStream           = false;
    this.streamReceivedLen  = 0;
    this.firstAudioFrame    = true;
    this.fetchController    = null;
    this.streamPauseParam   = null;
    this.logger             = new Logger("Player");
    this.initDownloadWorker();
    this.initDecodeWorker();
    setupFrame();
}

Player.prototype.setViewport = function (width, height) {
    var canvas = this.canvas;
    var gl = yuvCanvas.gl;
    // render mode
    // auto scale for fit mode
    let scale = Math.min(canvas.width / width, canvas.height / height);
    let scaleWidth = width * scale;
    let scaleHeight = height * scale;
    let x = canvas.width / 2 - scaleWidth / 2;
    let y = canvas.height / 2 - scaleHeight / 2;
    gl.viewport(x, y, scaleWidth, scaleHeight);

    // fill mode
    //gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}
Player.prototype.initDownloadWorker = function () {
    var self = this;
    this.downloadWorker = new Worker("downloader.js");
    this.downloadWorker.onmessage = function (evt) {
        var objData = evt.data;
        switch (objData.t) {
            case kGetFileInfoRsp:
                self.onGetFileInfo(objData.i);
                break;
            case kFileData:
                self.onFileData(objData.d, objData.s, objData.e, objData.q);
                break;
        }
    }
};

Player.prototype.initDecodeWorker = function () {
    var self = this;
    this.decodeWorker = new Worker("decoder.js");
    this.decodeWorker.onmessage = function (evt) {
        var objData = evt.data;
        switch (objData.t) {
            case kInitDecoderRsp:
                self.onInitDecoder(objData);
                break;
            case kOpenDecoderRsp:
                self.onOpenDecoder(objData);
                break;
            case kVideoFrame:
                self.onVideoFrame(objData);
                break;
            case kAudioFrame:
                self.onAudioFrame(objData);
                break;
            case kDecodeFinishedEvt:
                self.onDecodeFinished(objData);
                break;
            case kRequestDataEvt:
                self.onRequestData(objData.o, objData.a);
                break;
            case kSeekToRsp:
                self.onSeekToRsp(objData.r);
                break;
        }
    }
};

Player.prototype.play = function (url, canvas, callback, waitHeaderLength, isStream) {
    this.logger.logInfo("Play " + url + ".");

    var ret = {
        e: 0,
        m: "Success"
    };

    var success = true;
    do {
        if (this.playerState == playerStatePausing) {
            ret = this.resume();
            break;
        }

        if (this.playerState == playerStatePlaying) {
            break;
        }

        if (!url) {
            ret = {
                e: -1,
                m: "Invalid url"
            };
            success = false;
            this.logger.logError("[ER] playVideo error, url empty.");
            break;
        }

        if (!canvas) {
            ret = {
                e: -2,
                m: "Canvas not set"
            };
            success = false;
            this.logger.logError("[ER] playVideo error, canvas empty.");
            break;
        }

        if (!this.downloadWorker) {
            ret = {
                e: -3,
                m: "Downloader not initialized"
            };
            success = false;
            this.logger.logError("[ER] Downloader not initialized.");
            break
        }

        if (!this.decodeWorker) {
            ret = {
                e: -4,
                m: "Decoder not initialized"
            };
            success = false;
            this.logger.logError("[ER] Decoder not initialized.");
            break
        }

        if (url.startWith("ws://") || url.startWith("wss://")) {
            this.downloadProto = kProtoWebsocket;
        } else {
            this.downloadProto = kProtoHttp;
        }

        this.fileInfo = new FileInfo(url);
        this.canvas = canvas;
        this.callback = callback;
        this.waitHeaderLength = waitHeaderLength || this.waitHeaderLength;
        this.playerState = playerStatePlaying;
        this.isStream = isStream;
        this.startTrackTimer();
        this.displayLoop();

        //var playCanvasContext = playCanvas.getContext("2d"); //If get 2d, webgl will be disabled.

        if (!this.isStream) {
            var req = {
                t: kGetFileInfoReq,
                u: url,
                p: this.downloadProto
            };
            this.downloadWorker.postMessage(req);
        } else {
            this.requestStream(url);
            this.onGetFileInfo({
                sz: -1,
                st: 200
            });
        }

        var self = this;
        this.registerVisibilityEvent(function(visible) {
            if (visible) {
                self.resume();
            } else {
                self.pause();
            }
        });

        this.buffering = true;
        this.showLoading();
    } while (false);

    return ret;
};

Player.prototype.pauseStream = function () {
    if (this.playerState != playerStatePlaying) {
        var ret = {
            e: -1,
            m: "Not playing"
        };
        return ret;
    }

    this.streamPauseParam = {
        url: this.fileInfo.url,
        canvas: this.canvas,
        callback: this.callback,
        waitHeaderLength: this.waitHeaderLength
    }

    this.logger.logInfo("Stop in stream pause.");
    this.stop();

    var ret = {
        e: 0,
        m: "Success"
    };

    return ret;
}

Player.prototype.pause = function () {
    if (this.isStream) {
        return this.pauseStream();
    }

    this.logger.logInfo("Pause.");

    if (this.playerState != playerStatePlaying) {
        var ret = {
            e: -1,
            m: "Not playing"
        };
        return ret;
    }

    //Pause video rendering and audio flushing.
    this.playerState = playerStatePausing;

    //Pause audio context.
    if (this.pcmPlayer) {
        this.pcmPlayer.pause();
    }

    //Pause decoding.
    this.pauseDecoding();

    //Stop track timer.
    this.stopTrackTimer();

    //Do not stop downloader for background buffering.
    var ret = {
        e: 0,
        m: "Success"
    };

    return ret;
};

Player.prototype.resumeStream = function () {
    if (this.playerState != playerStateIdle || !this.streamPauseParam) {
        var ret = {
            e: -1,
            m: "Not pausing"
        };
        return ret;
    }

    this.logger.logInfo("Play in stream resume.");
    this.play(this.streamPauseParam.url,
              this.streamPauseParam.canvas,
              this.streamPauseParam.callback,
              this.streamPauseParam.waitHeaderLength,
              true);
    this.streamPauseParam = null;

    var ret = {
        e: 0,
        m: "Success"
    };

    return ret;
}

Player.prototype.resume = function (fromSeek) {
    if (this.isStream) {
        return this.resumeStream();
    }

    this.logger.logInfo("Resume.");

    if (this.playerState != playerStatePausing) {
        var ret = {
            e: -1,
            m: "Not pausing"
        };
        return ret;
    }

    if (!fromSeek) {
        //Resume audio context.
        this.pcmPlayer.resume();
    }

    //If there's a flying video renderer op, interrupt it.
    if (this.videoRendererTimer != null) {
        clearTimeout(this.videoRendererTimer);
        this.videoRendererTimer = null;
    }

    //Restart video rendering and audio flushing.
    this.playerState = playerStatePlaying;

    //Restart decoding.
    this.startDecoding();

    //Restart track timer.
    if (!this.seeking) {
        this.startTrackTimer();
    }

    var ret = {
        e: 0,
        m: "Success"
    };
    return ret;
};

Player.prototype.stop = function () {
    this.logger.logInfo("Stop.");
    if (this.playerState == playerStateIdle) {
        var ret = {
            e: -1,
            m: "Not playing"
        };
        return ret;
    }

    if (this.videoRendererTimer != null) {
        clearTimeout(this.videoRendererTimer);
        this.videoRendererTimer = null;
        this.logger.logInfo("Video renderer timer stopped.");
    }

    this.stopDownloadTimer();
    this.stopTrackTimer();
    this.hideLoading();

    this.fileInfo           = null;
    this.canvas             = null;
    this.callback           = null;
    this.duration           = 0;
    this.pixFmt             = 0;
    this.videoWidth         = 0;
    this.videoHeight        = 0;
    this.yLength            = 0;
    this.uvLength           = 0;
    this.beginTimeOffset    = 0;
    this.decoderState       = decoderStateIdle;
    this.playerState        = playerStateIdle;
    this.decoding           = false;
    this.frameBuffer        = [];
    this.buffering          = false;
    this.streamReceivedLen  = 0;
    this.firstAudioFrame    = true;
    this.urgent             = false;
    this.seekReceivedLen    = 0;

    if (this.pcmPlayer) {
        this.pcmPlayer.destroy();
        this.pcmPlayer = null;
        this.logger.logInfo("Pcm player released.");
    }

    if (this.timeTrack) {
        this.timeTrack.value = 0;
    }
    if (this.timeLabel) {
        this.timeLabel.innerHTML = this.formatTime(0) + "/" + this.displayDuration;
    }

    this.logger.logInfo("Closing decoder.");
    this.decodeWorker.postMessage({
        t: kCloseDecoderReq
    });


    this.logger.logInfo("Uniniting decoder.");
    this.decodeWorker.postMessage({
        t: kUninitDecoderReq
    });

    if (this.fetchController) {
        this.fetchController.abort();
        this.fetchController = null;
    }

    return ret;
};

Player.prototype.seekTo = function(ms) {
    if (this.isStream) {
        return;
    }

    // Pause playing.
    this.pause();

    // Stop download.
    this.stopDownloadTimer();

    // Clear frame buffer.
    this.frameBuffer.length = 0;

    // Request decoder to seek.
    this.decodeWorker.postMessage({
        t: kSeekToReq,
        ms: ms
    });

    // Reset begin time offset.
    this.beginTimeOffset = ms / 1000;
    this.logger.logInfo("seekTo beginTimeOffset " + this.beginTimeOffset);

    this.seeking = true;
    this.justSeeked = true;
    this.urgent = true;
    this.seekReceivedLen = 0;
    this.startBuffering();
};

Player.prototype.fullscreen = function () {
  // todo
};

Player.prototype.getState = function () {
    return this.playerState;
};

Player.prototype.setTrack = function (timeTrack, timeLabel) {
    this.timeTrack = timeTrack;
    this.timeLabel = timeLabel;

    if (this.timeTrack) {
        var self = this;
        this.timeTrack.oninput = function () {
            if (!self.seeking) {
                self.seekTo(self.timeTrack.value);
            }
        }
        this.timeTrack.onchange = function () {
            if (!self.seeking) {
                self.seekTo(self.timeTrack.value);
            }
        }
    }
};

Player.prototype.onGetFileInfo = function (info) {
    if (this.playerState == playerStateIdle) {
        return;
    }

    this.logger.logInfo("Got file size rsp:" + info.st + " size:" + info.sz + " byte.");
    if (info.st == 200) {
        this.fileInfo.size = Number(info.sz);
        this.logger.logInfo("Initializing decoder.");
        var req = {
            t: kInitDecoderReq,
            s: this.fileInfo.size,
            c: this.fileInfo.chunkSize
        };
        this.decodeWorker.postMessage(req);
    } else {
        this.reportPlayError(-1, info.st);
    }
};

Player.prototype.onFileData = function (data, start, end, seq) {
    //this.logger.logInfo("Got data bytes=" + start + "-" + end + ".");
    this.downloading = false;

    if (this.playerState == playerStateIdle) {
        return;
    }

    if (seq != this.downloadSeqNo) {
        return;  // Old data.
    }

    if (this.playerState == playerStatePausing) {
        if (this.seeking) {
            this.seekReceivedLen += data.byteLength;
            let left = this.fileInfo.size - this.fileInfo.offset;
            let seekWaitLen = Math.min(left, this.seekWaitLen);
            if (this.seekReceivedLen >= seekWaitLen) {
                this.logger.logInfo("Resume in seek now");
                setTimeout(() => {
                    this.resume(true);
                }, 0);
            }
        } else {
            return;
        }
    }

    var len = end - start + 1;
    this.fileInfo.offset += len;

    var objData = {
        t: kFeedDataReq,
        d: data
    };
    this.decodeWorker.postMessage(objData, [objData.d]);

    switch (this.decoderState) {
        case decoderStateIdle:
            this.onFileDataUnderDecoderIdle();
            break;
        case decoderStateInitializing:
            this.onFileDataUnderDecoderInitializing();
            break;
        case decoderStateReady:
            this.onFileDataUnderDecoderReady();
            break;
    }

    if (this.urgent) {
        setTimeout(() => {
            this.downloadOneChunk();
        }, 0);
    }
};

Player.prototype.onFileDataUnderDecoderIdle = function () {
    if (this.fileInfo.offset >= this.waitHeaderLength || (!this.isStream && this.fileInfo.offset == this.fileInfo.size)) {
        this.logger.logInfo("Opening decoder.");
        this.decoderState = decoderStateInitializing;
        var req = {
            t: kOpenDecoderReq
        };
        this.decodeWorker.postMessage(req);
    }

    this.downloadOneChunk();
};

Player.prototype.onFileDataUnderDecoderInitializing = function () {
    this.downloadOneChunk();
};

Player.prototype.onFileDataUnderDecoderReady = function () {
    //this.downloadOneChunk();
};

Player.prototype.onInitDecoder = function (objData) {
    if (this.playerState == playerStateIdle) {
        return;
    }

    this.logger.logInfo("Init decoder response " + objData.e + ".");
    if (objData.e == 0) {
        if (!this.isStream) {
            this.downloadOneChunk();
        }
    } else {
        this.reportPlayError(objData.e);
    }
};

Player.prototype.onOpenDecoder = function (objData) {
    if (this.playerState == playerStateIdle) {
        return;
    }

    this.logger.logInfo("Open decoder response " + objData.e + ".");
    if (objData.e == 0) {
        this.onVideoParam(objData.v);
        this.onAudioParam(objData.a);
        this.decoderState = decoderStateReady;
        this.logger.logInfo("Decoder ready now.");
        this.startDecoding();
    } else {
        this.reportPlayError(objData.e);
    }
};

Player.prototype.onVideoParam = function (v) {
    if (this.playerState == playerStateIdle) {
        return;
    }

    this.logger.logInfo("Video param duation:" + v.d + " pixFmt:" + v.p + " width:" + v.w + " height:" + v.h + ".");
    this.duration = v.d;
    this.pixFmt = v.p;
    //this.canvas.width = v.w;
    //this.canvas.height = v.h;
    this.videoWidth = v.w;
    this.videoHeight = v.h;
    this.yLength = this.videoWidth * this.videoHeight;
    this.uvLength = (this.videoWidth / 2) * (this.videoHeight / 2);
    //this.setViewport(this.videoWidth, this.videoHeight);


    if (this.timeTrack) {
        this.timeTrack.min = 0;
        this.timeTrack.max = this.duration;
        this.timeTrack.value = 0;
        this.displayDuration = this.formatTime(this.duration / 1000);
    }

    var byteRate = 1000 * this.fileInfo.size / this.duration;
    var targetSpeed = downloadSpeedByteRateCoef * byteRate;
    var chunkPerSecond = targetSpeed / this.fileInfo.chunkSize;
    this.chunkInterval = 1000 / chunkPerSecond;
    this.seekWaitLen = byteRate * maxBufferTimeLength * 2;
    this.logger.logInfo("Seek wait len " + this.seekWaitLen);

    if (!this.isStream) {
        this.startDownloadTimer();
    }

    this.logger.logInfo("Byte rate:" + byteRate + " target speed:" + targetSpeed + " chunk interval:" + this.chunkInterval + ".");
};

Player.prototype.onAudioParam = function (a) {
    if (this.playerState == playerStateIdle) {
        return;
    }

    this.logger.logInfo("Audio param sampleFmt:" + a.f + " channels:" + a.c + " sampleRate:" + a.r + ".");

    var sampleFmt = a.f;
    var channels = a.c;
    var sampleRate = a.r;

    var encoding = "16bitInt";
    switch (sampleFmt) {
        case 0:
            encoding = "8bitInt";
            break;
        case 1:
            encoding = "16bitInt";
            break;
        case 2:
            encoding = "32bitInt";
            break;
        case 3:
            encoding = "32bitFloat";
            break;
        default:
            this.logger.logError("Unsupported audio sampleFmt " + sampleFmt + "!");
    }
    this.logger.logInfo("Audio encoding " + encoding + ".");

    this.pcmPlayer = new PCMPlayer({
        encoding: encoding,
        channels: channels,
        sampleRate: sampleRate,
        flushingTime: 5000
    });

    this.audioEncoding      = encoding;
    this.audioChannels      = channels;
    this.audioSampleRate    = sampleRate;
};

Player.prototype.restartAudio = function () {
    if (this.pcmPlayer) {
        this.pcmPlayer.destroy();
        this.pcmPlayer = null;
    }

    this.pcmPlayer = new PCMPlayer({
        encoding: this.audioEncoding,
        channels: this.audioChannels,
        sampleRate: this.audioSampleRate,
        flushingTime: 5000
    });
};

Player.prototype.bufferFrame = function (frame) {
    // If not decoding, it may be frame before seeking, should be discarded.
    if (!this.decoding) {
        return;
    }
    this.frameBuffer.push(frame);
    //this.logger.logInfo("bufferFrame " + frame.s + ", seq " + frame.q);
    if (this.getBufferTimerLength() >= maxBufferTimeLength || this.decoderState == decoderStateFinished) {
        if (this.decoding) {
            //this.logger.logInfo("Frame buffer time length >= " + maxBufferTimeLength + ", pause decoding.");
            this.pauseDecoding();
        }
        if (this.buffering) {
            this.stopBuffering();
        }
    }
}

Player.prototype.displayAudioFrame = function (frame) {
    if (this.playerState != playerStatePlaying) {
        return false;
    }

    if (this.seeking) {
        this.restartAudio();
        this.startTrackTimer();
        this.hideLoading();
        this.seeking = false;
        this.urgent = false;
    }

    if (this.isStream && this.firstAudioFrame) {
        this.firstAudioFrame = false;
        this.beginTimeOffset = frame.s;
    }

    this.pcmPlayer.play(new Uint8Array(frame.d));
    return true;
};

Player.prototype.onAudioFrame = function (frame) {
    this.bufferFrame(frame);
};

Player.prototype.onDecodeFinished = function (objData) {
    this.pauseDecoding();
    this.decoderState   = decoderStateFinished;
};

Player.prototype.getBufferTimerLength = function() {
    if (!this.frameBuffer || this.frameBuffer.length == 0) {
        return 0;
    }

    let oldest = this.frameBuffer[0];
    let newest = this.frameBuffer[this.frameBuffer.length - 1];
    return newest.s - oldest.s;
};

Player.prototype.onVideoFrame = function (frame) {
    this.bufferFrame(frame);
};

Player.prototype.displayVideoFrame = function (frame) {
    if (this.playerState != playerStatePlaying) {
        return false;
    }

    if (this.seeking) {
        this.restartAudio();
        this.startTrackTimer();
        this.hideLoading();
        this.seeking = false;
        this.urgent = false;
    }

    var audioCurTs = this.pcmPlayer.getTimestamp();
    var audioTimestamp = audioCurTs + this.beginTimeOffset;
    var delay = frame.s - audioTimestamp;

    //this.logger.logInfo("displayVideoFrame delay=" + delay + "=" + " " + frame.s  + " - (" + audioCurTs  + " + " + this.beginTimeOffset + ")" + "->" + audioTimestamp);

    if (audioTimestamp <= 0 || delay <= 0) {
        var data = new Uint8Array(frame.d);
        this.renderVideoFrame(data);
        return true;
    }
    return false;
};

Player.prototype.onSeekToRsp = function (ret) {
    if (ret != 0) {
        this.justSeeked = false;
        this.seeking = false;
    }
};

Player.prototype.onRequestData = function (offset, available) {
    if (this.justSeeked) {
        this.logger.logInfo("Request data " + offset + ", available " + available);
        if (offset == -1) {
            // Hit in buffer.
            let left = this.fileInfo.size - this.fileInfo.offset;
            if (available >= left) {
                this.logger.logInfo("No need to wait");
                this.resume();
            } else {
                this.startDownloadTimer();
            }
        } else {
            if (offset >= 0 && offset < this.fileInfo.size) {
                this.fileInfo.offset = offset;
            }
            this.startDownloadTimer();
        }

        //this.restartAudio();
        this.justSeeked = false;
    }
};

Player.prototype.displayLoop = function() {
    if (this.playerState !== playerStateIdle) {
        requestAnimationFrame(this.displayLoop.bind(this));
    }
    if (this.playerState != playerStatePlaying) {
        return;
    }

    if (this.frameBuffer.length == 0) {
        return;
    }

    if (this.buffering) {
        return;
    }

    // requestAnimationFrame may be 60fps, if stream fps too large,
    // we need to render more frames in one loop, otherwise display
    // fps won't catch up with source fps, leads to memory increasing,
    // set to 2 now.
    for (i = 0; i < 2; ++i) {
        var frame = this.frameBuffer[0];
        switch (frame.t) {
            case kAudioFrame:
                if (this.displayAudioFrame(frame)) {
                    this.frameBuffer.shift();
                }
                break;
            case kVideoFrame:
                if (this.displayVideoFrame(frame)) {
                    this.frameBuffer.shift();
                }
                break;
            default:
                return;
        }

        if (this.frameBuffer.length == 0) {
            break;
        }
    }

    if (this.getBufferTimerLength() < maxBufferTimeLength / 2) {
        if (!this.decoding) {
            //this.logger.logInfo("Buffer time length < " + maxBufferTimeLength / 2 + ", restart decoding.");
            this.startDecoding();
        }
    }

    if (this.bufferFrame.length == 0) {
        if (this.decoderState == decoderStateFinished) {
            this.reportPlayError(1, 0, "Finished");
            this.stop();
        } else {
            this.startBuffering();
        }
    }
};

Player.prototype.startBuffering = function () {
    this.buffering = true;
    this.showLoading();
    this.pause();
}

Player.prototype.stopBuffering = function () {
    this.buffering = false;
    this.hideLoading();
    this.resume();
}

Player.prototype.renderVideoFrame = function (data) {
  yuvFrame.y =  {
    bytes: data.subarray(0, this.yLength),
    stride: this.videoWidth
  };
  yuvFrame.u =  {
    bytes: data.subarray(this.yLength, this.yLength + this.uvLength),
    stride: this.videoWidth / 2
  };
  yuvFrame.v =  {
    bytes: data.subarray(this.yLength + this.uvLength, data.length),
    stride: this.videoWidth / 2
  };
  yuvCanvas.drawFrame(yuvFrame);
};

Player.prototype.downloadOneChunk = function () {
    if (this.downloading || this.isStream) {
        return;
    }

    var start = this.fileInfo.offset;
    if (start >= this.fileInfo.size) {
        this.logger.logError("Reach file end.");
        this.stopDownloadTimer();
        return;
    }

    var end = this.fileInfo.offset + this.fileInfo.chunkSize - 1;
    if (end >= this.fileInfo.size) {
        end = this.fileInfo.size - 1;
    }

    var len = end - start + 1;
    if (len > this.fileInfo.chunkSize) {
        console.log("Error: request len:" + len + " > chunkSize:" + this.fileInfo.chunkSize);
        return;
    }

    var req = {
        t: kDownloadFileReq,
        u: this.fileInfo.url,
        s: start,
        e: end,
        q: this.downloadSeqNo,
        p: this.downloadProto
    };
    this.downloadWorker.postMessage(req);
    this.downloading = true;
};

Player.prototype.startDownloadTimer = function () {
    var self = this;
    this.downloadSeqNo++;
    this.downloadTimer = setInterval(function () {
        self.downloadOneChunk();
    }, this.chunkInterval);
};

Player.prototype.stopDownloadTimer = function () {
    if (this.downloadTimer != null) {
        clearInterval(this.downloadTimer);
        this.downloadTimer = null;
    }
    this.downloading = false;
};

Player.prototype.startTrackTimer = function () {
    var self = this;
    this.trackTimer = setInterval(function () {
        self.updateTrackTime();
    }, this.trackTimerInterval);
};

Player.prototype.stopTrackTimer = function () {
    if (this.trackTimer != null) {
        clearInterval(this.trackTimer);
        this.trackTimer = null;
    }
};

Player.prototype.updateTrackTime = function () {
    if (this.playerState == playerStatePlaying && this.pcmPlayer) {
        var currentPlayTime = this.pcmPlayer.getTimestamp() + this.beginTimeOffset;
        if (this.timeTrack) {
            this.timeTrack.value = 1000 * currentPlayTime;
        }

        if (this.timeLabel) {
            this.timeLabel.innerHTML = this.formatTime(currentPlayTime) + "/" + this.displayDuration;
        }
    }
};

Player.prototype.startDecoding = function () {
    var req = {
        t: kStartDecodingReq,
        i: this.urgent ? 0 : this.decodeInterval,
    };
    this.decodeWorker.postMessage(req);
    this.decoding = true;
};

Player.prototype.pauseDecoding = function () {
    var req = {
        t: kPauseDecodingReq
    };
    this.decodeWorker.postMessage(req);
    this.decoding = false;
};

Player.prototype.formatTime = function (s) {
    var h = Math.floor(s / 3600) < 10 ? '0' + Math.floor(s / 3600) : Math.floor(s / 3600);
    var m = Math.floor((s / 60 % 60)) < 10 ? '0' + Math.floor((s / 60 % 60)) : Math.floor((s / 60 % 60));
    var s = Math.floor((s % 60)) < 10 ? '0' + Math.floor((s % 60)) : Math.floor((s % 60));
    return result = h + ":" + m + ":" + s;
};

Player.prototype.reportPlayError = function (error, status, message) {
    var e = {
        error: error || 0,
        status: status || 0,
        message: message
    };

    if (this.callback) {
        this.callback(e);
    }
};

Player.prototype.setLoadingDiv = function (loadingDiv) {
    this.loadingDiv = loadingDiv;
}

Player.prototype.hideLoading = function () {
    if (this.loadingDiv != null) {
        loading.style.display = "none";
    }
};

Player.prototype.showLoading = function () {
    if (this.loadingDiv != null) {
        loading.style.display = "block";
    }
};

Player.prototype.registerVisibilityEvent = function (cb) {
    var hidden = "hidden";

    // Standards:
    if (hidden in document) {
        document.addEventListener("visibilitychange", onchange);
    } else if ((hidden = "mozHidden") in document) {
        document.addEventListener("mozvisibilitychange", onchange);
    } else if ((hidden = "webkitHidden") in document) {
        document.addEventListener("webkitvisibilitychange", onchange);
    } else if ((hidden = "msHidden") in document) {
        document.addEventListener("msvisibilitychange", onchange);
    } else if ("onfocusin" in document) {
        // IE 9 and lower.
        document.onfocusin = document.onfocusout = onchange;
    } else {
        // All others.
        window.onpageshow = window.onpagehide = window.onfocus = window.onblur = onchange;
    }

    function onchange (evt) {
        var v = true;
        var h = false;
        var evtMap = {
            focus:v,
            focusin:v,
            pageshow:v,
            blur:h,
            focusout:h,
            pagehide:h
        };

        evt = evt || window.event;
        var visible = v;
        if (evt.type in evtMap) {
            visible = evtMap[evt.type];
        } else {
            visible = this[hidden] ? h : v;
        }
        cb(visible);
    }

    // set the initial state (but only if browser supports the Page Visibility API)
    if( document[hidden] !== undefined ) {
        onchange({type: document[hidden] ? "blur" : "focus"});
    }
}

Player.prototype.onStreamDataUnderDecoderIdle = function (length) {
    if (this.streamReceivedLen >= this.waitHeaderLength) {
        this.logger.logInfo("Opening decoder.");
        this.decoderState = decoderStateInitializing;
        var req = {
            t: kOpenDecoderReq
        };
        this.decodeWorker.postMessage(req);
    } else {
        this.streamReceivedLen += length;
    }
};

Player.prototype.requestStream = function (url) {
    var self = this;
    this.fetchController = new AbortController();
    const signal = this.fetchController.signal;

    fetch(url, {signal}).then(async function respond(response) {
        const reader = response.body.getReader();
        reader.read().then(function processData({done, value}) {
            if (done) {
                self.logger.logInfo("Stream done.");
                return;
            }

            if (self.playerState != playerStatePlaying) {
                return;
            }

            var dataLength = value.byteLength;
            var offset = 0;
            if (dataLength > self.fileInfo.chunkSize) {
                do {
                    let len = Math.min(self.fileInfo.chunkSize, dataLength);
                    var data = value.buffer.slice(offset, offset + len);
                    dataLength -= len;
                    offset += len;
                    var objData = {
                        t: kFeedDataReq,
                        d: data
                    };
                    self.decodeWorker.postMessage(objData, [objData.d]);
                } while (dataLength > 0)
            } else {
                var objData = {
                    t: kFeedDataReq,
                    d: value.buffer
                };
                self.decodeWorker.postMessage(objData, [objData.d]);
            }

            if (self.decoderState == decoderStateIdle) {
                self.onStreamDataUnderDecoderIdle(dataLength);
            }

            return reader.read().then(processData);
        });
    }).catch(err => {
    });
};
window.Player = Player;

},{"./../src/yuv-canvas.js":10,"yuv-buffer":2}],5:[function(require,module,exports){
(function() {
  "use strict";

  /**
   * Create a YUVCanvas and attach it to an HTML5 canvas element.
   *
   * This will take over the drawing context of the canvas and may turn
   * it into a WebGL 3d canvas if possible. Do not attempt to use the
   * drawing context directly after this.
   *
   * @param {HTMLCanvasElement} canvas - HTML canvas element to attach to
   * @param {YUVCanvasOptions} options - map of options
   * @throws exception if WebGL requested but unavailable
   * @constructor
   * @abstract
   */
  function FrameSink(canvas, options) {
    throw new Error('abstract');
  }

  /**
   * Draw a single YUV frame on the underlying canvas, converting to RGB.
   * If necessary the canvas will be resized to the optimal pixel size
   * for the given buffer's format.
   *
   * @param {YUVBuffer} buffer - the YUV buffer to draw
   * @see {@link https://www.npmjs.com/package/yuv-buffer|yuv-buffer} for format
   */
  FrameSink.prototype.drawFrame = function(buffer) {
    throw new Error('abstract');
  };

  /**
   * Clear the canvas using appropriate underlying 2d or 3d context.
   */
  FrameSink.prototype.clear = function() {
    throw new Error('abstract');
  };

  module.exports = FrameSink;

})();

},{}],6:[function(require,module,exports){
/*
Copyright (c) 2014-2016 Brion Vibber <brion@pobox.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
MPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function() {
	"use strict";

	var FrameSink = require('./FrameSink.js'),
		YCbCr = require('./YCbCr.js');

	/**
	 * @param {HTMLCanvasElement} canvas - HTML canvas eledment to attach to
	 * @constructor
	 */
	function SoftwareFrameSink(canvas) {
		var self = this,
			ctx = canvas.getContext('2d'),
			imageData = null,
			resampleCanvas = null,
			resampleContext = null;



		function initImageData(width, height) {
			imageData = ctx.createImageData(width, height);

			// Prefill the alpha to opaque
			var data = imageData.data,
				pixelCount = width * height * 4;
			for (var i = 0; i < pixelCount; i += 4) {
				data[i + 3] = 255;
			}
		}

		function initResampleCanvas(cropWidth, cropHeight) {
			resampleCanvas = document.createElement('canvas');
			resampleCanvas.width = cropWidth;
			resampleCanvas.height = cropHeight;
			resampleContext = resampleCanvas.getContext('2d');
		}

		/**
		 * Actually draw a frame into the canvas.
		 * @param {YUVFrame} buffer - YUV frame buffer object to draw
		 */
		self.drawFrame = function drawFrame(buffer) {
			var format = buffer.format;

			if (canvas.width !== format.displayWidth || canvas.height !== format.displayHeight) {
				// Keep the canvas at the right size...
				canvas.width = format.displayWidth;
				canvas.height = format.displayHeight;
			}

			if (imageData === null ||
					imageData.width != format.width ||
					imageData.height != format.height) {
				initImageData(format.width, format.height);
			}

			// YUV -> RGB over the entire encoded frame
			YCbCr.convertYCbCr(buffer, imageData.data);

			var resample = (format.cropWidth != format.displayWidth || format.cropHeight != format.displayHeight);
			var drawContext;
			if (resample) {
				// hack for non-square aspect-ratio
				// putImageData doesn't resample, so we have to draw in two steps.
				if (!resampleCanvas) {
					initResampleCanvas(format.cropWidth, format.cropHeight);
				}
				drawContext = resampleContext;
			} else {
				drawContext = ctx;
			}

			// Draw cropped frame to either the final or temporary canvas
			drawContext.putImageData(imageData,
				-format.cropLeft, -format.cropTop, // must offset the offset
				format.cropLeft, format.cropTop,
				format.cropWidth, format.cropHeight);

			if (resample) {
				ctx.drawImage(resampleCanvas, 0, 0, format.displayWidth, format.displayHeight);
			}
		};

		self.clear = function() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		};

		return self;
	}

	SoftwareFrameSink.prototype = Object.create(FrameSink.prototype);

	module.exports = SoftwareFrameSink;
})();

},{"./FrameSink.js":5,"./YCbCr.js":8}],7:[function(require,module,exports){
/*
Copyright (c) 2014-2016 Brion Vibber <brion@pobox.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
MPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function() {
	"use strict";

	var FrameSink = require('./FrameSink.js'),
		shaders = require('../build/shaders.js');

	/**
	 * Warning: canvas must not have been used for 2d drawing prior!
	 *
	 * @param {HTMLCanvasElement} canvas - HTML canvas element to attach to
	 * @constructor
	 */
	function WebGLFrameSink(canvas) {
		var self = this,
			gl = WebGLFrameSink.contextForCanvas(canvas),
			debug = false; // swap this to enable more error checks, which can slow down rendering

		if (gl === null) {
			throw new Error('WebGL unavailable');
		}

		// GL!
		function checkError() {
			if (debug) {
				err = gl.getError();
				if (err !== 0) {
					throw new Error("GL error " + err);
				}
			}
		}

		function compileShader(type, source) {
			var shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				var err = gl.getShaderInfoLog(shader);
				gl.deleteShader(shader);
				throw new Error('GL shader compilation for ' + type + ' failed: ' + err);
			}

			return shader;
		}


		var program,
			unpackProgram,
			err;

		// In the world of GL there are no rectangles.
		// There are only triangles.
		// THERE IS NO SPOON.
		var rectangle = new Float32Array([
			// First triangle (top left, clockwise)
			-1.0, -1.0,
			+1.0, -1.0,
			-1.0, +1.0,

			// Second triangle (bottom right, clockwise)
			-1.0, +1.0,
			+1.0, -1.0,
			+1.0, +1.0
		]);

		var textures = {};
		var framebuffers = {};
		var stripes = {};
		var buf, positionLocation, unpackPositionLocation;
		var unpackTexturePositionBuffer, unpackTexturePositionLocation;
		var stripeLocation, unpackTextureLocation;
		var lumaPositionBuffer, lumaPositionLocation;
		var chromaPositionBuffer, chromaPositionLocation;

		function createOrReuseTexture(name, formatUpdate) {
			if (!textures[name] || formatUpdate) {
				textures[name] = gl.createTexture();
			}
			return textures[name];
		}

		function uploadTexture(name, formatUpdate, width, height, data) {
			var create = !textures[name] || formatUpdate;
			var texture = createOrReuseTexture(name, formatUpdate);
			gl.activeTexture(gl.TEXTURE0);

			if (WebGLFrameSink.stripe) {
				var uploadTemp = !textures[name + '_temp'] || formatUpdate;
				var tempTexture = createOrReuseTexture(name + '_temp', formatUpdate);
				gl.bindTexture(gl.TEXTURE_2D, tempTexture);
				if (uploadTemp) {
					// new texture
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
					gl.texImage2D(
						gl.TEXTURE_2D,
						0, // mip level
						gl.RGBA, // internal format
						width / 4,
						height,
						0, // border
						gl.RGBA, // format
						gl.UNSIGNED_BYTE, // type
						data // data!
					);
				} else {
					// update texture
					gl.texSubImage2D(
						gl.TEXTURE_2D,
						0, // mip level
						0, // x offset
						0, // y offset
						width / 4,
						height,
						gl.RGBA, // format
						gl.UNSIGNED_BYTE, // type
						data // data!
					);
				}

				var stripeTexture = textures[name + '_stripe'];
				var uploadStripe = !stripeTexture || formatUpdate;
				if (uploadStripe) {
					stripeTexture = createOrReuseTexture(name + '_stripe', formatUpdate);
				}
				gl.bindTexture(gl.TEXTURE_2D, stripeTexture);
				if (uploadStripe) {
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
					gl.texImage2D(
						gl.TEXTURE_2D,
						0, // mip level
						gl.RGBA, // internal format
						width,
						1,
						0, // border
						gl.RGBA, // format
						gl.UNSIGNED_BYTE, //type
						buildStripe(width, 1) // data!
					);
				}

			} else {
				gl.bindTexture(gl.TEXTURE_2D, texture);
				if (create) {
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texImage2D(
						gl.TEXTURE_2D,
						0, // mip level
						gl.ALPHA, // internal format
						width,
						height,
						0, // border
						gl.ALPHA, // format
						gl.UNSIGNED_BYTE, //type
						data // data!
					);
				} else {
					gl.texSubImage2D(
						gl.TEXTURE_2D,
						0, // mip level
						0, // x
						0, // y
						width,
						height,
						gl.ALPHA, // internal format
						gl.UNSIGNED_BYTE, //type
						data // data!
					);
				}
			}
		}

		function unpackTexture(name, formatUpdate, width, height) {
			var texture = textures[name];

			// Upload to a temporary RGBA texture, then unpack it.
			// This is faster than CPU-side swizzling in ANGLE on Windows.
			gl.useProgram(unpackProgram);

			var fb = framebuffers[name];
			if (!fb || formatUpdate) {
				// Create a framebuffer and an empty target size
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texImage2D(
					gl.TEXTURE_2D,
					0, // mip level
					gl.RGBA, // internal format
					width,
					height,
					0, // border
					gl.RGBA, // format
					gl.UNSIGNED_BYTE, //type
					null // data!
				);

				fb = framebuffers[name] = gl.createFramebuffer();
			}

			gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

			var tempTexture = textures[name + '_temp'];
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, tempTexture);
			gl.uniform1i(unpackTextureLocation, 1);

			var stripeTexture = textures[name + '_stripe'];
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, stripeTexture);
			gl.uniform1i(stripeLocation, 2);

			// Rectangle geometry
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.enableVertexAttribArray(positionLocation);
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

			// Set up the texture geometry...
			gl.bindBuffer(gl.ARRAY_BUFFER, unpackTexturePositionBuffer);
			gl.enableVertexAttribArray(unpackTexturePositionLocation);
			gl.vertexAttribPointer(unpackTexturePositionLocation, 2, gl.FLOAT, false, 0, 0);

			// Draw into the target texture...
			gl.viewport(0, 0, width, height);

			gl.drawArrays(gl.TRIANGLES, 0, rectangle.length / 2);

			gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		}

		function attachTexture(name, register, index) {
			gl.activeTexture(register);
			gl.bindTexture(gl.TEXTURE_2D, textures[name]);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

			gl.uniform1i(gl.getUniformLocation(program, name), index);
		}

		function buildStripe(width) {
			if (stripes[width]) {
				return stripes[width];
			}
			var len = width,
				out = new Uint32Array(len);
			for (var i = 0; i < len; i += 4) {
				out[i    ] = 0x000000ff;
				out[i + 1] = 0x0000ff00;
				out[i + 2] = 0x00ff0000;
				out[i + 3] = 0xff000000;
			}
			return stripes[width] = new Uint8Array(out.buffer);
		}

		function initProgram(vertexShaderSource, fragmentShaderSource) {
			var vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
			var fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

			var program = gl.createProgram();
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);

			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				var err = gl.getProgramInfoLog(program);
				gl.deleteProgram(program);
				throw new Error('GL program linking failed: ' + err);
			}

			return program;
		}

		function init() {
			if (WebGLFrameSink.stripe) {
				unpackProgram = initProgram(shaders.vertexStripe, shaders.fragmentStripe);
				unpackPositionLocation = gl.getAttribLocation(unpackProgram, 'aPosition');

				unpackTexturePositionBuffer = gl.createBuffer();
				var textureRectangle = new Float32Array([
					0, 0,
					1, 0,
					0, 1,
					0, 1,
					1, 0,
					1, 1
				]);
				gl.bindBuffer(gl.ARRAY_BUFFER, unpackTexturePositionBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);

				unpackTexturePositionLocation = gl.getAttribLocation(unpackProgram, 'aTexturePosition');
				stripeLocation = gl.getUniformLocation(unpackProgram, 'uStripe');
				unpackTextureLocation = gl.getUniformLocation(unpackProgram, 'uTexture');
			}
			program = initProgram(shaders.vertex, shaders.fragment);

			buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, rectangle, gl.STATIC_DRAW);

			positionLocation = gl.getAttribLocation(program, 'aPosition');
			lumaPositionBuffer = gl.createBuffer();
			lumaPositionLocation = gl.getAttribLocation(program, 'aLumaPosition');
			chromaPositionBuffer = gl.createBuffer();
			chromaPositionLocation = gl.getAttribLocation(program, 'aChromaPosition');
		}

		/**
		 * Actually draw a frame.
		 * @param {YUVFrame} buffer - YUV frame buffer object
		 */
		self.drawFrame = function(buffer) {
			var format = buffer.format;

			var formatUpdate = (!program || canvas.width !== format.displayWidth || canvas.height !== format.displayHeight);
			if (formatUpdate) {
				// Keep the canvas at the right size...
				canvas.width = format.displayWidth;
				canvas.height = format.displayHeight;
				self.clear();
			}

			if (!program) {
				init();
			}

			if (formatUpdate) {
				var setupTexturePosition = function(buffer, location, texWidth) {
					// Warning: assumes that the stride for Cb and Cr is the same size in output pixels
					var textureX0 = format.cropLeft / texWidth;
					var textureX1 = (format.cropLeft + format.cropWidth) / texWidth;
					var textureY0 = (format.cropTop + format.cropHeight) / format.height;
					var textureY1 = format.cropTop / format.height;
					var textureRectangle = new Float32Array([
						textureX0, textureY0,
						textureX1, textureY0,
						textureX0, textureY1,
						textureX0, textureY1,
						textureX1, textureY0,
						textureX1, textureY1
					]);

					gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
					gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);
				};
				setupTexturePosition(
					lumaPositionBuffer,
					lumaPositionLocation,
					buffer.y.stride);
				setupTexturePosition(
					chromaPositionBuffer,
					chromaPositionLocation,
					buffer.u.stride * format.width / format.chromaWidth);
			}

			// Create or update the textures...
			uploadTexture('uTextureY', formatUpdate, buffer.y.stride, format.height, buffer.y.bytes);
			uploadTexture('uTextureCb', formatUpdate, buffer.u.stride, format.chromaHeight, buffer.u.bytes);
			uploadTexture('uTextureCr', formatUpdate, buffer.v.stride, format.chromaHeight, buffer.v.bytes);

			if (WebGLFrameSink.stripe) {
				// Unpack the textures after upload to avoid blocking on GPU
				unpackTexture('uTextureY', formatUpdate, buffer.y.stride, format.height);
				unpackTexture('uTextureCb', formatUpdate, buffer.u.stride, format.chromaHeight);
				unpackTexture('uTextureCr', formatUpdate, buffer.v.stride, format.chromaHeight);
			}

			// Set up the rectangle and draw it
			gl.useProgram(program);
			gl.viewport(0, 0, canvas.width, canvas.height);

			attachTexture('uTextureY', gl.TEXTURE0, 0);
			attachTexture('uTextureCb', gl.TEXTURE1, 1);
			attachTexture('uTextureCr', gl.TEXTURE2, 2);

			// Set up geometry
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.enableVertexAttribArray(positionLocation);
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

			// Set up the texture geometry...
			gl.bindBuffer(gl.ARRAY_BUFFER, lumaPositionBuffer);
			gl.enableVertexAttribArray(lumaPositionLocation);
			gl.vertexAttribPointer(lumaPositionLocation, 2, gl.FLOAT, false, 0, 0);

			gl.bindBuffer(gl.ARRAY_BUFFER, chromaPositionBuffer);
			gl.enableVertexAttribArray(chromaPositionLocation);
			gl.vertexAttribPointer(chromaPositionLocation, 2, gl.FLOAT, false, 0, 0);

			// Aaaaand draw stuff.
			gl.drawArrays(gl.TRIANGLES, 0, rectangle.length / 2);
		};

		self.clear = function() {
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(0.0, 0.0, 0.0, 0.0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		};

		self.clear();

		return self;
	}

	// Optional performance hack for Windows; luminance and alpha textures are
	// ssllooww to upload on some machines, so we pack into RGBA and unpack in
	// the shaders.
	//
	// Some browsers / GPUs seem to have no problem with this, others have
	// a huge impact in CPU doing the texture uploads.
	//
	// For instance on macOS 12.2 on a MacBook Pro 2018 with AMD GPU it
	// can real down at high res. This is partially compensated for by
	// improving the upload-vs-update behavior for the alpha textures.
	//
	// Currently keeping it off as of April 2022, but leaving it in so it
	// can be enabled if desired.
	WebGLFrameSink.stripe = false;

	WebGLFrameSink.contextForCanvas = function(canvas) {
		var options = {
			// Don't trigger discrete GPU in multi-GPU systems
			preferLowPowerToHighPerformance: true,
			powerPreference: 'low-power',
			// Don't try to use software GL rendering!
			failIfMajorPerformanceCaveat: true,
			// In case we need to capture the resulting output.
			preserveDrawingBuffer: true
		};
		return canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
	};

	/**
	 * Static function to check if WebGL will be available with appropriate features.
	 *
	 * @returns {boolean} - true if available
	 */
	WebGLFrameSink.isAvailable = function() {
		var canvas = document.createElement('canvas'),
			gl;
		canvas.width = 1;
		canvas.height = 1;
		try {
			gl = WebGLFrameSink.contextForCanvas(canvas);
		} catch (e) {
			return false;
		}
		if (gl) {
			var register = gl.TEXTURE0,
				width = 4,
				height = 4,
				texture = gl.createTexture(),
				data = new Uint8Array(width * height),
				texWidth = WebGLFrameSink.stripe ? (width / 4) : width,
				format = WebGLFrameSink.stripe ? gl.RGBA : gl.ALPHA,
				filter = WebGLFrameSink.stripe ? gl.NEAREST : gl.LINEAR;

			gl.activeTexture(register);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0, // mip level
				format, // internal format
				texWidth,
				height,
				0, // border
				format, // format
				gl.UNSIGNED_BYTE, //type
				data // data!
			);

			var err = gl.getError();
			if (err) {
				// Doesn't support alpha textures?
				return false;
			} else {
				return true;
			}
		} else {
			return false;
		}
	};

	WebGLFrameSink.prototype = Object.create(FrameSink.prototype);

	module.exports = WebGLFrameSink;
})();

},{"../build/shaders.js":1,"./FrameSink.js":5}],8:[function(require,module,exports){
/*
Copyright (c) 2014-2019 Brion Vibber <brion@pobox.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
MPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function() {
	"use strict";

	var depower = require('./depower.js');

	/**
	 * Basic YCbCr->RGB conversion
	 *
	 * @author Brion Vibber <brion@pobox.com>
	 * @copyright 2014-2019
	 * @license MIT-style
	 *
	 * @param {YUVFrame} buffer - input frame buffer
	 * @param {Uint8ClampedArray} output - array to draw RGBA into
	 * Assumes that the output array already has alpha channel set to opaque.
	 */
	function convertYCbCr(buffer, output) {
		var width = buffer.format.width | 0,
			height = buffer.format.height | 0,
			hdec = depower(buffer.format.width / buffer.format.chromaWidth) | 0,
			vdec = depower(buffer.format.height / buffer.format.chromaHeight) | 0,
			bytesY = buffer.y.bytes,
			bytesCb = buffer.u.bytes,
			bytesCr = buffer.v.bytes,
			strideY = buffer.y.stride | 0,
			strideCb = buffer.u.stride | 0,
			strideCr = buffer.v.stride | 0,
			outStride = width << 2,
			YPtr = 0, Y0Ptr = 0, Y1Ptr = 0,
			CbPtr = 0, CrPtr = 0,
			outPtr = 0, outPtr0 = 0, outPtr1 = 0,
			colorCb = 0, colorCr = 0,
			multY = 0, multCrR = 0, multCbCrG = 0, multCbB = 0,
			x = 0, y = 0, xdec = 0, ydec = 0;

		if (hdec == 1 && vdec == 1) {
			// Optimize for 4:2:0, which is most common
			outPtr0 = 0;
			outPtr1 = outStride;
			ydec = 0;
			for (y = 0; y < height; y += 2) {
				Y0Ptr = y * strideY | 0;
				Y1Ptr = Y0Ptr + strideY | 0;
				CbPtr = ydec * strideCb | 0;
				CrPtr = ydec * strideCr | 0;
				for (x = 0; x < width; x += 2) {
					colorCb = bytesCb[CbPtr++] | 0;
					colorCr = bytesCr[CrPtr++] | 0;

					// Quickie YUV conversion
					// https://en.wikipedia.org/wiki/YCbCr#ITU-R_BT.2020_conversion
					// multiplied by 256 for integer-friendliness
					multCrR   = (409 * colorCr | 0) - 57088 | 0;
					multCbCrG = (100 * colorCb | 0) + (208 * colorCr | 0) - 34816 | 0;
					multCbB   = (516 * colorCb | 0) - 70912 | 0;

					multY = 298 * bytesY[Y0Ptr++] | 0;
					output[outPtr0    ] = (multY + multCrR) >> 8;
					output[outPtr0 + 1] = (multY - multCbCrG) >> 8;
					output[outPtr0 + 2] = (multY + multCbB) >> 8;
					outPtr0 += 4;

					multY = 298 * bytesY[Y0Ptr++] | 0;
					output[outPtr0    ] = (multY + multCrR) >> 8;
					output[outPtr0 + 1] = (multY - multCbCrG) >> 8;
					output[outPtr0 + 2] = (multY + multCbB) >> 8;
					outPtr0 += 4;

					multY = 298 * bytesY[Y1Ptr++] | 0;
					output[outPtr1    ] = (multY + multCrR) >> 8;
					output[outPtr1 + 1] = (multY - multCbCrG) >> 8;
					output[outPtr1 + 2] = (multY + multCbB) >> 8;
					outPtr1 += 4;

					multY = 298 * bytesY[Y1Ptr++] | 0;
					output[outPtr1    ] = (multY + multCrR) >> 8;
					output[outPtr1 + 1] = (multY - multCbCrG) >> 8;
					output[outPtr1 + 2] = (multY + multCbB) >> 8;
					outPtr1 += 4;
				}
				outPtr0 += outStride;
				outPtr1 += outStride;
				ydec++;
			}
		} else {
			outPtr = 0;
			for (y = 0; y < height; y++) {
				xdec = 0;
				ydec = y >> vdec;
				YPtr = y * strideY | 0;
				CbPtr = ydec * strideCb | 0;
				CrPtr = ydec * strideCr | 0;

				for (x = 0; x < width; x++) {
					xdec = x >> hdec;
					colorCb = bytesCb[CbPtr + xdec] | 0;
					colorCr = bytesCr[CrPtr + xdec] | 0;

					// Quickie YUV conversion
					// https://en.wikipedia.org/wiki/YCbCr#ITU-R_BT.2020_conversion
					// multiplied by 256 for integer-friendliness
					multCrR   = (409 * colorCr | 0) - 57088 | 0;
					multCbCrG = (100 * colorCb | 0) + (208 * colorCr | 0) - 34816 | 0;
					multCbB   = (516 * colorCb | 0) - 70912 | 0;

					multY = 298 * bytesY[YPtr++] | 0;
					output[outPtr    ] = (multY + multCrR) >> 8;
					output[outPtr + 1] = (multY - multCbCrG) >> 8;
					output[outPtr + 2] = (multY + multCbB) >> 8;
					outPtr += 4;
				}
			}
		}
	}

	module.exports = {
		convertYCbCr: convertYCbCr
	};
})();

},{"./depower.js":9}],9:[function(require,module,exports){
/*
Copyright (c) 2014-2016 Brion Vibber <brion@pobox.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
MPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function() {
  "use strict";

  /**
   * Convert a ratio into a bit-shift count; for instance a ratio of 2
   * becomes a bit-shift of 1, while a ratio of 1 is a bit-shift of 0.
   *
   * @author Brion Vibber <brion@pobox.com>
   * @copyright 2016
   * @license MIT-style
   *
   * @param {number} ratio - the integer ratio to convert.
   * @returns {number} - number of bits to shift to multiply/divide by the ratio.
   * @throws exception if given a non-power-of-two
   */
  function depower(ratio) {
    var shiftCount = 0,
      n = ratio >> 1;
    while (n != 0) {
      n = n >> 1;
      shiftCount++
    }
    if (ratio !== (1 << shiftCount)) {
      throw 'chroma plane dimensions must be power of 2 ratio to luma plane dimensions; got ' + ratio;
    }
    return shiftCount;
  }

  module.exports = depower;
})();

},{}],10:[function(require,module,exports){
/*
Copyright (c) 2014-2016 Brion Vibber <brion@pobox.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
MPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function() {
  "use strict";

  var FrameSink = require('./FrameSink.js'),
    SoftwareFrameSink = require('./SoftwareFrameSink.js'),
    WebGLFrameSink = require('./WebGLFrameSink.js');

  /**
   * @typedef {Object} YUVCanvasOptions
   * @property {boolean} webGL - Whether to use WebGL to draw to the canvas and accelerate color space conversion. If left out, defaults to auto-detect.
   */

  var YUVCanvas = {
    FrameSink: FrameSink,

    SoftwareFrameSink: SoftwareFrameSink,

    WebGLFrameSink: WebGLFrameSink,

    /**
     * Attach a suitable FrameSink instance to an HTML5 canvas element.
     *
     * This will take over the drawing context of the canvas and may turn
     * it into a WebGL 3d canvas if possible. Do not attempt to use the
     * drawing context directly after this.
     *
     * @param {HTMLCanvasElement} canvas - HTML canvas element to attach to
     * @param {YUVCanvasOptions} options - map of options
     * @returns {FrameSink} - instance of suitable subclass.
     */
    attach: function(canvas, options) {
      options = options || {};
      var webGL = ('webGL' in options) ? options.webGL : WebGLFrameSink.isAvailable();
      if (webGL) {
        return new WebGLFrameSink(canvas, options);
      } else {
        return new SoftwareFrameSink(canvas, options);
      }
    }
  };

  module.exports = YUVCanvas;
})();

},{"./FrameSink.js":5,"./SoftwareFrameSink.js":6,"./WebGLFrameSink.js":7}]},{},[4,3]);
