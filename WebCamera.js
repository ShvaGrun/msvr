function getWebCamera() {
    const webCam = document.createElement('video');
    webCam.setAttribute('autoplay', true);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(function (stream) {
                webCam.srcObject = stream;
            })
            .catch(function (e) {
                console.error('Rejected!', e);
            });
    } else {
        console.error('navigator.mediaDevices is not supported by your browser');
    }

    return webCam;
}

function setTexture() {
    const webCamTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webCamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return webCamTexture;
}
