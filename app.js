(function () {
  'use strict';

  /** @type {Cropper|null} */
  var cropper = null;
  var originalMimeType = 'image/jpeg';
  var originalFileName = '';
  var dataUrl = null;
  var imageNaturalWidth = 0;
  var imageNaturalHeight = 0;

  /* -------------------------------------------------------
     EXIF orientation reader (JPEG only)
     Returns the EXIF orientation value (1–8), defaulting
     to 1 (normal) when absent or unreadable.
  ------------------------------------------------------- */
  function readExifOrientation(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    // Must start with JPEG SOI marker FF D8
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
      return 1;
    }

    var offset = 2;
    while (offset + 4 <= view.byteLength) {
      var marker = view.getUint16(offset, false);
      offset += 2;

      // Ensure we have a valid segment length field
      if (offset + 2 > view.byteLength) break;
      var segLen = view.getUint16(offset, false); // includes the 2-byte length field itself

      if (marker === 0xffe1) {
        // APP1 segment – check for 'Exif\0\0'
        if (segLen < 8) break;
        if (view.getUint32(offset + 2, false) !== 0x45786966) break; // 'Exif'
        if (view.getUint16(offset + 6, false) !== 0x0000) break;     // null terminator

        var tiffBase = offset + 8; // TIFF header starts here
        if (tiffBase + 8 > view.byteLength) break;

        var littleEndian = view.getUint16(tiffBase, false) === 0x4949; // 'II'
        if (view.getUint16(tiffBase + 2, littleEndian) !== 42) break;   // TIFF magic

        var ifd0 = view.getUint32(tiffBase + 4, littleEndian);
        var ifdStart = tiffBase + ifd0;
        if (ifdStart + 2 > view.byteLength) break;

        var entries = view.getUint16(ifdStart, littleEndian);
        for (var i = 0; i < entries; i++) {
          var entryOffset = ifdStart + 2 + i * 12;
          if (entryOffset + 12 > view.byteLength) break;
          if (view.getUint16(entryOffset, littleEndian) === 0x0112) {
            // Orientation tag – type SHORT, value fits in the value/offset field
            return view.getUint16(entryOffset + 8, littleEndian);
          }
        }
        break;
      }

      // Skip to the next segment
      if ((marker & 0xff00) !== 0xff00) break; // not a valid JPEG marker
      offset += segLen;
    }

    return 1;
  }

  /* -------------------------------------------------------
     Orientation description for the badge
  ------------------------------------------------------- */
  var ORIENTATION_LABELS = {
    1: 'Normal – no rotation needed',
    2: 'Mirrored horizontally',
    3: 'Rotated 180°',
    4: 'Mirrored vertically',
    5: 'Rotated 90° CW + mirrored',
    6: 'Rotated 90° CW',
    7: 'Rotated 90° CCW + mirrored',
    8: 'Rotated 90° CCW',
  };

  /* -------------------------------------------------------
     Compute longest edge of the current crop in natural
     image pixels and update the input field.
  ------------------------------------------------------- */
  function updateLongestEdge() {
    if (!cropper) return;
    var data = cropper.getData();
    var imgData = cropper.getImageData();
    // getData() returns coordinates in canvas-pixel space;
    // scale up to natural image pixels.
    var scaleX = imgData.naturalWidth  / imgData.width;
    var scaleY = imgData.naturalHeight / imgData.height;
    var w = Math.round(data.width  * scaleX);
    var h = Math.round(data.height * scaleY);
    var longest = Math.max(w, h);
    if (longest > 0) {
      document.getElementById('longestEdge').value = longest;
    }
  }

  /* -------------------------------------------------------
     Initialise / re-initialise Cropper.js
  ------------------------------------------------------- */
  function initCropper(src) {
    var img = document.getElementById('cropperImage');

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    img.src = src;

    cropper = new Cropper(img, {
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,
      restore: false,
      // Do NOT let Cropper.js auto-correct EXIF orientation –
      // the editor intentionally shows the raw (un-oriented) image.
      checkOrientation: false,
      ready: function () {
        var imgData = cropper.getImageData();
        imageNaturalWidth  = imgData.naturalWidth;
        imageNaturalHeight = imgData.naturalHeight;
        // Set initial longest-edge value from actual natural image dimensions
        updateLongestEdge();
      },
      crop: function () {
        updateLongestEdge();
      },
    });
  }

  /* -------------------------------------------------------
     File selection handler
  ------------------------------------------------------- */
  function handleFile(file) {
    if (!file) return;
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      alert('Please select a JPEG or PNG image.');
      return;
    }

    originalMimeType = file.type;
    originalFileName = file.name;

    var reader = new FileReader();
    reader.onload = function (evt) {
      dataUrl = evt.target.result;

      // ---- set both preview images ----
      var previewExif = document.getElementById('previewExif');
      var previewRaw  = document.getElementById('previewRaw');
      previewExif.src = dataUrl;
      previewRaw.src  = dataUrl;

      // ---- read EXIF orientation for the badge ----
      //      (CSS image-orientation handles the visual flip automatically)
      if (file.type === 'image/jpeg') {
        // Re-read as ArrayBuffer so we can parse the binary EXIF data
        var abReader = new FileReader();
        abReader.onload = function (abEvt) {
          var orientation = readExifOrientation(abEvt.target.result);
          var label = ORIENTATION_LABELS[orientation] || ('Value ' + orientation);
          document.getElementById('exifBadge').textContent =
            'EXIF Orientation tag: ' + orientation + ' – ' + label;
        };
        abReader.readAsArrayBuffer(file);
      } else {
        document.getElementById('exifBadge').textContent =
          'PNG – no EXIF orientation tag';
      }

      // ---- initialise editor ----
      initCropper(dataUrl);

      // ---- show the main content ----
      document.getElementById('mainContent').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  /* -------------------------------------------------------
     Download handler
  ------------------------------------------------------- */
  function downloadImage() {
    if (!cropper) return;

    var longestEdgeInput = parseInt(document.getElementById('longestEdge').value, 10);
    var outputFormat     = document.getElementById('outputFormat').value;

    // Get the cropped canvas – Cropper.js bakes the rotation / flip in
    var canvas = cropper.getCroppedCanvas();
    if (!canvas) {
      alert('Could not process the image. Please try again.');
      return;
    }

    // Resize to the requested longest edge (maintaining aspect ratio)
    if (longestEdgeInput > 0) {
      var w = canvas.width;
      var h = canvas.height;
      var longest = Math.max(w, h);
      if (longest !== longestEdgeInput) {
        var scale    = longestEdgeInput / longest;
        var newW     = Math.max(1, Math.round(w * scale));
        var newH     = Math.max(1, Math.round(h * scale));
        var resized  = document.createElement('canvas');
        resized.width  = newW;
        resized.height = newH;
        resized.getContext('2d').drawImage(canvas, 0, 0, newW, newH);
        canvas = resized;
      }
    }

    // Determine MIME type and file extension
    var mimeType = outputFormat === 'original' ? originalMimeType : outputFormat;
    var ext      = mimeType === 'image/png' ? 'png' : 'jpg';

    // toBlob strips all EXIF metadata (it only encodes pixel data)
    var quality = mimeType === 'image/jpeg' ? 0.92 : undefined;
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a   = document.createElement('a');
      var baseName = originalFileName.replace(/\.[^.]+$/, '') || 'image';
      a.href     = url;
      a.download = baseName + '_noexif.' + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, mimeType, quality);
  }

  /* -------------------------------------------------------
     Boot
  ------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var imageInput        = document.getElementById('imageInput');
    var uploadArea        = document.getElementById('uploadArea');
    var rotateCCW         = document.getElementById('rotateCCW');
    var rotateCW          = document.getElementById('rotateCW');
    var flipH             = document.getElementById('flipH');
    var flipV             = document.getElementById('flipV');
    var resetCrop         = document.getElementById('resetCrop');
    var downloadBtn       = document.getElementById('downloadBtn');
    var resetLongestEdge  = document.getElementById('resetLongestEdge');
    var aspectOriginalBtn = document.getElementById('aspectOriginal');
    var aspect1x1Btn      = document.getElementById('aspect1x1');

    imageInput.addEventListener('change', function (e) {
      handleFile(e.target.files[0]);
    });

    // Editor control buttons
    rotateCCW.addEventListener('click', function () {
      if (cropper) cropper.rotate(-90);
    });
    rotateCW.addEventListener('click', function () {
      if (cropper) cropper.rotate(90);
    });
    flipH.addEventListener('click', function () {
      if (!cropper) return;
      var data = cropper.getData();
      cropper.scaleX(-(data.scaleX || 1));
    });
    flipV.addEventListener('click', function () {
      if (!cropper) return;
      var data = cropper.getData();
      cropper.scaleY(-(data.scaleY || 1));
    });
    resetCrop.addEventListener('click', function () {
      if (!cropper) return;
      cropper.reset();
      cropper.setAspectRatio(NaN);
      aspectOriginalBtn.classList.remove('active');
      aspect1x1Btn.classList.remove('active');
    });

    // Aspect ratio buttons
    aspectOriginalBtn.addEventListener('click', function () {
      if (!cropper) return;
      if (aspectOriginalBtn.classList.contains('active')) {
        cropper.setAspectRatio(NaN);
        aspectOriginalBtn.classList.remove('active');
      } else {
        cropper.setAspectRatio(imageNaturalWidth / imageNaturalHeight);
        aspectOriginalBtn.classList.add('active');
        aspect1x1Btn.classList.remove('active');
      }
    });
    aspect1x1Btn.addEventListener('click', function () {
      if (!cropper) return;
      if (aspect1x1Btn.classList.contains('active')) {
        cropper.setAspectRatio(NaN);
        aspect1x1Btn.classList.remove('active');
      } else {
        cropper.setAspectRatio(1);
        aspect1x1Btn.classList.add('active');
        aspectOriginalBtn.classList.remove('active');
      }
    });

    // Reset longest-edge input to natural crop size
    resetLongestEdge.addEventListener('click', function () {
      updateLongestEdge();
    });

    downloadBtn.addEventListener('click', downloadImage);

    // Drag-and-drop support
    uploadArea.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', function () {
      uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  });

}());
