"use strict";
const $ = id => document.getElementById(id);
let stream, recorder, timer, drawFrame, origin, duration = 0, chunks = [], videoURL, startTime = null, endTime = null, recording = false;
const canvas = $("canvas"), ctx = canvas.getContext("2d");
const seconds = value => value.toFixed(2) + " 秒";
function message(text = "") { $("message").textContent = text; }
function reviewEnabled(enabled) { for (const id of ["back", "forward", "markStart", "markEnd"]) $(id).disabled = !enabled; }
function calculate() {
  $("from").textContent = startTime === null ? "—" : seconds(startTime);
  $("to").textContent = endTime === null ? "—" : seconds(endTime);
  const interval = endTime - startTime;
  const valid = startTime !== null && endTime !== null && interval > 0;
  $("elapsed").textContent = valid ? seconds(interval) : "—";
  const distance = Number($("distance").value) * ($("unit").value === "cm" ? .01 : 1);
  $("speed").innerHTML = "— <small>m/s</small>";
  $("formula").textContent = "速さ ＝ 距離 ÷ 時間";
  $("calcHint").textContent = !valid && startTime !== null && endTime !== null ? "終了点は開始点より後に選んでください。" : "開始点と終了点を選び、距離を入力してください。";
  if (valid && Number.isFinite(distance) && distance > 0) {
    $("speed").innerHTML = (distance / interval).toFixed(2) + " <small>m/s</small>";
    $("formula").textContent = `${distance.toLocaleString("ja-JP", {maximumFractionDigits: 6})} m ÷ ${seconds(interval)}（選択時刻で計算）`;
    $("calcHint").textContent = "選んだ区間の平均の速さです。";
  }
}
function paint() {
  if (!recording) return;
  const time = (performance.now() - origin) / 1000;
  ctx.drawImage($("live"), 0, 0, canvas.width, canvas.height);
  const size = Math.max(26, Math.round(canvas.width / 28));
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillRect(14, canvas.height - size * 2.2, size * 7, size * 1.8);
  ctx.font = `bold ${size}px monospace`; ctx.fillStyle = "white";
  ctx.fillText(`${time.toFixed(2)} s`, 26, canvas.height - size * .9);
  drawFrame = requestAnimationFrame(paint);
}
function closeCamera() {
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  $("live").srcObject = null; $("empty").hidden = false;
  $("start").disabled = true; $("close").disabled = true; $("open").disabled = false; $("facing").disabled = false;
  $("status").textContent = "カメラを閉じました";
}
$("open").onclick = async () => {
  message(); $("open").disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("カメラは localhost または HTTPS で開いてください。");
    if (!window.MediaRecorder || !canvas.captureStream) throw new Error("このブラウザーは録画に対応していません。最新の Chrome または Edge でお試しください。");
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: $("facing").value }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    $("live").srcObject = stream; await $("live").play();
    $("empty").hidden = true; $("start").disabled = false; $("close").disabled = false; $("facing").disabled = true;
    $("status").textContent = "撮影できます";
    stream.getVideoTracks()[0].addEventListener("ended", () => { if (recording) stopRecording(); closeCamera(); });
  } catch (error) {
    closeCamera(); message(error.name === "NotAllowedError" ? "カメラの使用を許可してください。ブラウザーのサイト設定から変更できます。" : error.name === "NotFoundError" ? "カメラが見つかりません。接続を確認してください。" : error.message);
  }
};
$("start").onclick = () => {
  message();
  try {
    canvas.width = $("live").videoWidth; canvas.height = $("live").videoHeight;
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4", "video/webm"].find(t => MediaRecorder.isTypeSupported(t));
    const capture = canvas.captureStream(30);
    recorder = new MediaRecorder(capture, type ? { mimeType: type } : {});
    chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      capture.getTracks().forEach(track => track.stop());
      if (videoURL) URL.revokeObjectURL(videoURL);
      const blob = new Blob(chunks, { type: recorder.mimeType });
      videoURL = URL.createObjectURL(blob); $("playback").src = videoURL; $("playback").style.display = "block";
      $("download").href = videoURL; $("download").download = `速さの実験-${Date.now()}.${recorder.mimeType.includes("mp4") ? "mp4" : "webm"}`;
      $("download").hidden = false; $("reviewHint").textContent = "再生して、測定したい区間を選んでください。";
      startTime = endTime = null; calculate(); reviewEnabled(true);
      $("start").disabled = !stream; $("close").disabled = !stream;
    };
    recorder.onerror = () => { message("録画中にエラーが発生しました。録画をやり直してください。"); stopRecording(); };
    origin = performance.now(); recording = true; paint(); recorder.start(1000);
    timer = setInterval(() => $("clock").innerHTML = ((performance.now() - origin) / 1000).toFixed(2) + " <small>秒</small>", 10);
    $("start").disabled = true; $("stop").disabled = false; $("close").disabled = true; $("recording").hidden = false;
    $("status").textContent = "録画中";
  } catch (error) { recording = false; clearInterval(timer); cancelAnimationFrame(drawFrame); message("録画を開始できませんでした：" + error.message); }
};
function stopRecording() {
  if (!recording) return;
  duration = (performance.now() - origin) / 1000; recording = false;
  clearInterval(timer); cancelAnimationFrame(drawFrame);
  $("clock").innerHTML = duration.toFixed(2) + " <small>秒</small>";
  if (recorder.state !== "inactive") recorder.stop();
  $("stop").disabled = true; $("recording").hidden = true; $("status").textContent = "録画が完了しました";
}
$("stop").onclick = stopRecording; $("close").onclick = closeCamera;
const playback = $("playback");
function position() { $("position").textContent = seconds(playback.currentTime); }
playback.addEventListener("timeupdate", position); playback.addEventListener("seeked", position);
playback.addEventListener("loadedmetadata", () => { position(); });
function seek(offset) { playback.pause(); const limit = Number.isFinite(playback.duration) ? playback.duration : duration; playback.currentTime = Math.max(0, Math.min(limit, playback.currentTime + offset)); }
$("back").onclick = () => seek(-.01); $("forward").onclick = () => seek(.01);
$("markStart").onclick = () => { playback.pause(); startTime = Math.round(playback.currentTime * 100) / 100; calculate(); };
$("markEnd").onclick = () => { playback.pause(); endTime = Math.round(playback.currentTime * 100) / 100; calculate(); };
$("distance").oninput = calculate; $("unit").onchange = calculate;
document.addEventListener("visibilitychange", () => { if (document.hidden && recording) { stopRecording(); message("画面が非表示になったため、録画を終了しました。"); } });
window.addEventListener("beforeunload", event => { if (recording || videoURL) { event.preventDefault(); event.returnValue = ""; } });
