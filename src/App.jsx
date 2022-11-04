import React, { useEffect, useState } from "react";
import imageBackground from "./assets/imgs/indira-logo-white-transparent.svg";
import "./App.css";
import "./assets/css/controls-utils.css";
const ort = require("onnxruntime-web");
import { FPS, ControlPanel, Toggle, SourcePicker, Slider } from "@mediapipe/control_utils";
import $ from "jquery";
import cv from "@techstark/opencv-js";
import _ from "lodash";
import { FaceDetection } from "@mediapipe/face_detection";
import { testSupport } from "./utils/utils.js";
import {
  hr_scalers,
  spo2_scalers,
  nibp_sys_scalers,
  nibp_dia_scalers,
  nibp_map_scalers,
  hr_target_scale,
  spo2_target_scale,
  nibp_sys_target_scale,
  nibp_dia_target_scale,
  nibp_map_target_scale,
} from "./utils/scalers-constants.js";
import Navbar from "./components/navbar/Navbar.jsx";
import Presentation from "./components/presentation/Presentation.jsx";

function App({ setComponentLoaded }) {
  const [start, setStart] = useState(false);
  const handleClickStart = () => {
    $(".presentation").fadeOut(400, function () {
      setStart(true);
      $("#main").fadeIn(400);
    });
  };

  let rgb_channel_data = { r_channel: [], g_channel: [], b_channel: [] };
  let process_vital_signs_detections = "stop";
  let seconds = 0;
  let timer_progress_bar = null;
  let number_frames = 0;
  const hr_spo2_encoder_length = 9;
  const nibp_encoder_length = 41;
  const decoder_length = 1;
  let fps = 10;
  let fps_setted = false;
  let fps_history_to_set_fps = [];
  let initial_maximum_number_frames = 10;
  let maximum_number_frames_hr_spo2 = fps * hr_spo2_encoder_length;
  let maximum_number_frames_nibp = fps * nibp_encoder_length;
  let hr_inference_session = null;
  let spo2_inference_session = null;
  let nibp_sys_inference_session = null;
  let nibp_dia_inference_session = null;
  let nibp_map_inference_session = null;
  let inputs_names_hr_inference_session = null;
  let inputs_names_spo2_inference_session = null;
  let inputs_names_nibp_sys_inference_session = null;
  let inputs_names_nibp_dia_inference_session = null;
  let inputs_names_nibp_map_inference_session = null;
  let hr_values_history_to_report = [];
  let spo2_values_history_to_report = [];
  let nibp_sys_dia_to_report = null;
  let nibp_map_to_report = null;
  const fpsControl = new FPS(); // We'll add this to our control panel later, but we'll save it here so we can call tick() each time the graph runs.

  const set_max_height_div_vital_signs = () => {
    let height_window = $(window).height();
    let width_window = $(window).width();
    let max_height = null;
    if (height_window > width_window) {
      let height_div_camera = $("#div_camera").height();
      max_height = height_window - height_div_camera - 33;
    } else {
      max_height = height_window - 33;
    }
    $("#div_vital_signs").css({ "max-height": max_height + "px" });
  };

  const create_inference_sessions = async () => {
    try {
      hr_inference_session = await ort.InferenceSession.create("./predictor_models/hr_predictor_model.onnx", {
        executionProviders: ["wasm"],
      });
      /* el canvas recibe el video, oculto el loader */
      setComponentLoaded(true);
      // setVideoLoaded(true);
      spo2_inference_session = await ort.InferenceSession.create("./predictor_models/spo2_predictor_model.onnx", {
        executionProviders: ["wasm"],
      });
      nibp_sys_inference_session = await ort.InferenceSession.create(
        "./predictor_models/nibp_sys_predictor_model.onnx",
        {
          executionProviders: ["wasm"],
        }
      );
      nibp_dia_inference_session = await ort.InferenceSession.create(
        "./predictor_models/nibp_dia_predictor_model.onnx",
        {
          executionProviders: ["wasm"],
        }
      );
      nibp_map_inference_session = await ort.InferenceSession.create(
        "./predictor_models/nibp_map_predictor_model.onnx",
        {
          executionProviders: ["wasm"],
        }
      );

      inputs_names_hr_inference_session = hr_inference_session.handler.inputNames;
      inputs_names_spo2_inference_session = spo2_inference_session.handler.inputNames;
      inputs_names_nibp_sys_inference_session = nibp_sys_inference_session.handler.inputNames;
      inputs_names_nibp_dia_inference_session = nibp_dia_inference_session.handler.inputNames;
      inputs_names_nibp_map_inference_session = nibp_map_inference_session.handler.inputNames;
    } catch (e) {
      setError(`failed to inference ONNX model: ${e}.`);
    }
  };

  const show_report_vital_signs = () => {
    let current_date = new Date();
    let current_month = current_date.toLocaleDateString("en-us", { month: "long" });
    $("#modal_report_vital_signs")
      .find("#date_report_vital_signs")
      .text(current_month + " " + current_date.getDate() + ", " + current_date.getFullYear());
    $("#modal_report_vital_signs")
      .find("#time_report_vital_signs")
      .text(current_date.getHours() + ":" + current_date.getMinutes());
    let average_hr_value = Math.round(_.mean(hr_values_history_to_report));
    $("#modal_report_vital_signs").find("#hr_value_report_vital_signs").text(average_hr_value);
    let average_spo2_value = Math.round(_.mean(spo2_values_history_to_report));
    $("#modal_report_vital_signs").find("#spo2_value_report_vital_signs").text(average_spo2_value);
    console.log("nibp_sys_dia_to_report", nibp_sys_dia_to_report);
    console.log("nibp_map_to_report", nibp_map_to_report);
    $("#modal_report_vital_signs").find("#nibp_sys_dia_value_report_vital_signs").text(nibp_sys_dia_to_report);
    $("#modal_report_vital_signs").find("#nibp_map_value_report_vital_signs").text(nibp_map_to_report);
    //const modal_report_vital_signs = new bootstrap.Modal("#modal_report_vital_signs");
    //modal_report_vital_signs.show();
  };

  const control_process_vital_signs_detections = () => {
    if (process_vital_signs_detections === "stop") {
      $("#button_process_vital_signs_detections").removeClass("btn-primary");
      $("#button_process_vital_signs_detections").addClass("btn-danger");
      $("#button_process_vital_signs_detections > i").removeClass("bi-play-fill");
      $("#button_process_vital_signs_detections > i").addClass("bi-stop-fill");
      $("#div_vital_signs_values").removeClass("d-none");
      $("#div_vital_signs_values").addClass("d-block");
      $("#video_progress_bar").removeClass("d-none");
      $("#video_progress_bar").addClass("d-block");
      seconds = 0;
      timer_progress_bar = setInterval(() => {
        seconds++;
        if (seconds <= 60) {
          let width = seconds * (100 / 60);
          $("#video_progress_bar div.progress-bar").css({ width: width + "%" });
          $("#video_progress_bar div.progress-bar").text(Math.round(width) + "%");
          $("#video_progress_bar div.progress-bar").attr("aria-valuenow", Math.round(width));
        } else {
          control_process_vital_signs_detections();
        }
      }, 1000);
      process_vital_signs_detections = "play";
      number_frames = 0;
      rgb_channel_data = { r_channel: [], g_channel: [], b_channel: [] };
      fps_setted = false;
      fps_history_to_set_fps = [];
      initial_maximum_number_frames = Math.round(_.mean(fpsControl.g) * (hr_spo2_encoder_length / 2));
      hr_values_history_to_report = [];
      spo2_values_history_to_report = [];
      nibp_sys_dia_to_report = null;
      nibp_map_to_report = null;
    } else if (process_vital_signs_detections === "play") {
      $("#button_process_vital_signs_detections").removeClass("btn-danger");
      $("#button_process_vital_signs_detections").addClass("btn-primary");
      $("#button_process_vital_signs_detections > i").removeClass("bi-stop-fill");
      $("#button_process_vital_signs_detections > i").addClass("bi-play-fill");
      $("#div_vital_signs_values").removeClass("d-block");
      $("#div_vital_signs_values").addClass("d-none");
      process_vital_signs_detections = "stop";
      if ($("#div_hr_value").hasClass("d-block")) {
        $("#div_hr_value").next("span.spinner-border").removeClass("d-none");
        $("#div_hr_value").removeClass("d-block");
        $("#div_hr_value").addClass("d-none");
      }
      if ($("#div_spo2_value").hasClass("d-block")) {
        $("#div_spo2_value").next("span.spinner-border").removeClass("d-none");
        $("#div_spo2_value").removeClass("d-block");
        $("#div_spo2_value").addClass("d-none");
      }
      if ($("#div_nibp_value").hasClass("d-block")) {
        $("#div_nibp_value").next("span.spinner-border").removeClass("d-none");
        $("#div_nibp_value").removeClass("d-block");
        $("#div_nibp_value").addClass("d-none");
      }
      $("#video_progress_bar").removeClass("d-block");
      $("#video_progress_bar").addClass("d-none");
      clearInterval(timer_progress_bar);
      show_report_vital_signs();
    }
  };

  const get_face_coordinates = (boundingBox_detected, canvas) => {
    let half_width = boundingBox_detected.width / 2;
    let half_height = boundingBox_detected.height / 2;

    let coordinates = {
      x1: (boundingBox_detected.xCenter - half_width) * canvas.width,
      y1: (boundingBox_detected.yCenter - half_height) * canvas.height,
      x2: (boundingBox_detected.xCenter + half_width) * canvas.width,
      y2: (boundingBox_detected.yCenter + half_height) * canvas.height,
    };

    return coordinates;
  };

  const get_roi_rectangle = (landmarks_detected, canvas) => {
    let eye_landmarks = {
      right: {
        x: landmarks_detected[0].x * canvas.width,
        y: landmarks_detected[0].y * canvas.height,
      },
      left: {
        x: landmarks_detected[1].x * canvas.width,
        y: landmarks_detected[1].y * canvas.height,
      },
    };

    let height_roi = Math.abs(eye_landmarks.right.x - eye_landmarks.left.x) / 2;
    let mean_y_eyes = (eye_landmarks.right.y + eye_landmarks.left.y) / 2;

    let coordinates = {
      x1: eye_landmarks.right.x,
      y1: mean_y_eyes - height_roi * 2 * 0.9,
      x2: eye_landmarks.left.x,
      y2: mean_y_eyes - height_roi,
    };

    if (coordinates.x1 < 0) {
      coordinates.x1 = 0;
    }

    if (coordinates.x2 < 0) {
      coordinates.x2 = 0;
    }

    if (coordinates.x1 > canvas.width) {
      coordinates.x1 = canvas.width;
    }

    if (coordinates.x2 > canvas.width) {
      coordinates.x2 = canvas.width;
    }

    if (coordinates.y1 < 0) {
      coordinates.y1 = 0;
    }

    if (coordinates.y2 < 0) {
      coordinates.y2 = 0;
    }

    if (coordinates.y1 > canvas.height) {
      coordinates.y1 = canvas.height;
    }

    if (coordinates.y2 > canvas.height) {
      coordinates.y2 = canvas.height;
    }

    if (coordinates.x2 - coordinates.x1 < 5) {
      coordinates.x1 = coordinates.x1 - 5 > 0 ? coordinates.x1 - 5 : 0;
      coordinates.x2 = coordinates.x2 + 5 < canvas.width ? coordinates.x2 + 5 : canvas.width;
    }

    if (coordinates.y2 - coordinates.y1 < 5) {
      coordinates.y1 = coordinates.y1 - 5 > 0 ? coordinates.y1 - 5 : 0;
      coordinates.y2 = coordinates.y2 + 5 < canvas.height ? coordinates.y2 + 5 : canvas.height;
    }

    let rectangle = {
      x: Math.round(coordinates.x1),
      y: Math.round(coordinates.y1),
      width: Math.round(coordinates.x2 - coordinates.x1),
      height: Math.round(coordinates.y2 - coordinates.y1),
    };

    return rectangle;
  };

  const get_skin_pixels = (roi) => {
    let roi_HSV = new cv.Mat();
    cv.cvtColor(roi, roi_HSV, cv.COLOR_RGB2HSV);
    let roi_HSV_mask = new cv.Mat();
    let roi_HSV_mask_lowerb = new cv.Mat(roi_HSV.rows, roi_HSV.cols, roi_HSV.type(), [0, 15, 0, 0]);
    let roi_HSV_mask_upperb = new cv.Mat(roi_HSV.rows, roi_HSV.cols, roi_HSV.type(), [17, 170, 255, 255]);
    cv.inRange(roi_HSV, roi_HSV_mask_lowerb, roi_HSV_mask_upperb, roi_HSV_mask);
    //HSV_mask = cv2.morphologyEx(HSV_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    let roi_YCrCb = new cv.Mat();
    cv.cvtColor(roi, roi_YCrCb, cv.COLOR_RGB2YCrCb);
    let roi_YCrCb_mask = new cv.Mat();
    let roi_YCrCb_mask_lowerb = new cv.Mat(roi_YCrCb.rows, roi_YCrCb.cols, roi_YCrCb.type(), [0, 135, 85, 0]);
    let roi_YCrCb_mask_upperb = new cv.Mat(roi_YCrCb.rows, roi_YCrCb.cols, roi_YCrCb.type(), [255, 180, 135, 255]);
    cv.inRange(roi_YCrCb, roi_YCrCb_mask_lowerb, roi_YCrCb_mask_upperb, roi_YCrCb_mask);
    //YCrCb_mask = cv2.morphologyEx(YCrCb_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    let roi_YCrCb_HSV_mask = new cv.Mat();
    cv.bitwise_and(roi_YCrCb_mask, roi_HSV_mask, roi_YCrCb_HSV_mask);
    //YCrCb_HSV_mask = cv2.medianBlur(YCrCb_HSV_mask, 3)
    //YCrCb_HSV_mask = cv2.morphologyEx(YCrCb_HSV_mask, cv2.MORPH_OPEN, np.ones((11, 11), np.uint8))

    let skin_pixels = new cv.Mat();
    cv.bitwise_and(roi, roi, skin_pixels, roi_YCrCb_HSV_mask);

    //cv.imshow('canvasOutput', skin_pixels);

    roi_HSV.delete();
    roi_HSV_mask.delete();
    roi_HSV_mask_lowerb.delete();
    roi_HSV_mask_upperb.delete();
    roi_YCrCb.delete();
    roi_YCrCb_mask.delete();
    roi_YCrCb_mask_lowerb.delete();
    roi_YCrCb_mask_upperb.delete();
    roi_YCrCb_HSV_mask.delete();

    return skin_pixels;
  };

  const get_average_each_rgb_channel_roi = (roi) => {
    let [r_channel_average, g_channel_average, b_channel_average] = [0, 0, 0];

    try {
      let skin_pixels = get_skin_pixels(roi);

      let skin_pixels_per_channel = new cv.MatVector();
      cv.split(skin_pixels, skin_pixels_per_channel);

      let nonzero_skin_pixels_in_r_channel = _.filter(skin_pixels_per_channel.get(0).data, (value) => value !== 0);
      let nonzero_skin_pixels_in_g_channel = _.filter(skin_pixels_per_channel.get(1).data, (value) => value !== 0);
      let nonzero_skin_pixels_in_b_channel = _.filter(skin_pixels_per_channel.get(2).data, (value) => value !== 0);

      r_channel_average = nonzero_skin_pixels_in_r_channel.length === 0 ? 0 : _.mean(nonzero_skin_pixels_in_r_channel);
      g_channel_average = nonzero_skin_pixels_in_g_channel.length === 0 ? 0 : _.mean(nonzero_skin_pixels_in_g_channel);
      b_channel_average = nonzero_skin_pixels_in_b_channel.length === 0 ? 0 : _.mean(nonzero_skin_pixels_in_b_channel);

      skin_pixels.delete();
      skin_pixels_per_channel.delete();
    } catch (err) {
      console.error(err);
    }

    return [r_channel_average, g_channel_average, b_channel_average];
  };
  /* ----------------------- */
  const [dataC, setDataC] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    try {
      testSupport([{ client: "Chrome" }]);
    } catch (error) {
      console.log("Error getting detected device:::", error);
    }
    // enable DEBUG flag
    ort.env.debug = true;
    // set global logging level
    ort.env.logLevel = "info";
    // enable worker-proxy feature for WebAssembly
    // this feature allows model inferencing to run in a web worker asynchronously.
    ort.env.wasm.proxy = true;

    const drawingUtils = window;
    const mpFaceDetection = window;
    const videoElement = document.getElementsByClassName("input_video")[0]; // Our input frames will come from here.
    const canvasElement = document.getElementsByClassName("output_canvas")[0];
    if (!videoElement || !canvasElement) return;
    const controlsElement = document.getElementsByClassName("mediapipe-controls-panel")[0];
    const canvasCtx = canvasElement.getContext("2d", { alpha: false, willReadFrequently: true });

    $(window).on("load", () => {
      console.log("pag cargada");
      //set_max_height_div_vital_signs();
      create_inference_sessions();
    });

    $(window).resize(() => {
      //set_max_height_div_vital_signs();
    });

    $("#button_process_vital_signs_detections").on("click", () => {
      control_process_vital_signs_detections();
    });

    const faceDetection = new FaceDetection({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`;
      },
    });

    faceDetection.onResults((results) => {
      // Hide the spinner.
      document.body.classList.add("loaded");

      // Update the frame rate.
      fpsControl.tick();
      // Draw the overlays.
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

      let frame = cv.imread(canvasElement);

      if (results.detections.length > 0) {
        let roi_rectangle = get_roi_rectangle(results.detections[0].landmarks, canvasCtx.canvas);

        if (process_vital_signs_detections === "play") {
          let roi = new cv.Mat();
          roi = frame.roi(roi_rectangle);

          cv.cvtColor(roi, roi, cv.COLOR_RGBA2RGB);

          let [r_channel_average_roi, g_channel_average_roi, b_channel_average_roi] =
            get_average_each_rgb_channel_roi(roi);

          //cv.cvtColor(roi, roi, cv.COLOR_RGB2RGBA);
          //cv.imshow('canvasOutput', roi);
          roi.delete();

          rgb_channel_data.r_channel.push(r_channel_average_roi);
          rgb_channel_data.g_channel.push(g_channel_average_roi);
          rgb_channel_data.b_channel.push(b_channel_average_roi);

          if (fps_setted === true) {
            if (number_frames >= maximum_number_frames_hr_spo2 && number_frames % fps === 0) {
              let hr_encoder_values = [];
              let spo2_encoder_values = [];

              for (let second = 0; second < hr_spo2_encoder_length; second++) {
                for (let channel in rgb_channel_data) {
                  let channel_data = rgb_channel_data[channel].slice(-maximum_number_frames_hr_spo2);
                  let channel_data_in_second = channel_data.slice(second * fps, (second + 1) * fps);
                  let encoder_value = Math.round(_.mean(channel_data_in_second));
                  let hr_encoder_value = (encoder_value - hr_scalers[channel].center) / hr_scalers[channel].scale;
                  let spo2_encoder_value = (encoder_value - spo2_scalers[channel].center) / spo2_scalers[channel].scale;
                  hr_encoder_values.push(hr_encoder_value);
                  spo2_encoder_values.push(spo2_encoder_value);
                }
              }

              const typed_hr_encoder_values = Float32Array.from(hr_encoder_values);
              const tensor_hr_encoder_values = new ort.Tensor("float32", typed_hr_encoder_values, [1, 9, 3]);
              const typed_hr_encoder_lengths = BigInt64Array.from([BigInt(hr_spo2_encoder_length)]);
              const tensor_hr_encoder_lengths = new ort.Tensor("int64", typed_hr_encoder_lengths, [1]);
              const typed_hr_decoder_values = Float32Array.from(hr_encoder_values.slice(-3));
              const tensor_hr_decoder_values = new ort.Tensor("float32", typed_hr_decoder_values, [1, 1, 3]);
              const typed_hr_decoder_lengths = BigInt64Array.from([BigInt(decoder_length)]);
              const tensor_hr_decoder_lengths = new ort.Tensor("int64", typed_hr_decoder_lengths, [1]);
              const typed_hr_target_scale = Float64Array.from(hr_target_scale);
              const tensor_hr_target_scale = new ort.Tensor("float64", typed_hr_target_scale, [1, 2]);

              const typed_spo2_encoder_values = Float32Array.from(spo2_encoder_values);
              const tensor_spo2_encoder_values = new ort.Tensor("float32", typed_spo2_encoder_values, [1, 9, 3]);
              const typed_spo2_encoder_lengths = BigInt64Array.from([BigInt(hr_spo2_encoder_length)]);
              const tensor_spo2_encoder_lengths = new ort.Tensor("int64", typed_spo2_encoder_lengths, [1]);
              const typed_spo2_decoder_values = Float32Array.from(spo2_encoder_values.slice(-3));
              const tensor_spo2_decoder_values = new ort.Tensor("float32", typed_spo2_decoder_values, [1, 1, 3]);
              const typed_spo2_decoder_lengths = BigInt64Array.from([BigInt(decoder_length)]);
              const tensor_spo2_decoder_lengths = new ort.Tensor("int64", typed_spo2_decoder_lengths, [1]);
              const typed_spo2_target_scale = Float64Array.from(spo2_target_scale);
              const tensor_spo2_target_scale = new ort.Tensor("float64", typed_spo2_target_scale, [1, 2]);

              const feeds_hr_inference_session = {
                [inputs_names_hr_inference_session[0]]: tensor_hr_encoder_values,
                [inputs_names_hr_inference_session[1]]: tensor_hr_encoder_lengths,
                [inputs_names_hr_inference_session[2]]: tensor_hr_decoder_values,
                [inputs_names_hr_inference_session[3]]: tensor_hr_decoder_lengths,
                [inputs_names_hr_inference_session[4]]: tensor_hr_target_scale,
              };

              const feeds_spo2_inference_session = {
                [inputs_names_spo2_inference_session[0]]: tensor_spo2_encoder_values,
                [inputs_names_spo2_inference_session[1]]: tensor_spo2_encoder_lengths,
                [inputs_names_spo2_inference_session[2]]: tensor_spo2_decoder_values,
                [inputs_names_spo2_inference_session[3]]: tensor_spo2_decoder_lengths,
                [inputs_names_spo2_inference_session[4]]: tensor_spo2_target_scale,
              };

              hr_inference_session
                .run(feeds_hr_inference_session)
                .then((result) => {
                  if ($("#div_hr_value").hasClass("d-none")) {
                    $("#div_hr_value").next("span.spinner-border").addClass("d-none");
                    $("#div_hr_value").removeClass("d-none");
                    $("#div_hr_value").addClass("d-block");
                  }
                  let hr_value = Math.round(result.prediction.data[3]);
                  $("#hr_value").text(hr_value);
                  hr_values_history_to_report.push(hr_value);
                })
                .catch((error) => console.error(error));

              spo2_inference_session
                .run(feeds_spo2_inference_session)
                .then((result) => {
                  if ($("#div_spo2_value").hasClass("d-none")) {
                    $("#div_spo2_value").next("span.spinner-border").addClass("d-none");
                    $("#div_spo2_value").removeClass("d-none");
                    $("#div_spo2_value").addClass("d-block");
                  }
                  let spo2_value = Math.round(result.prediction.data[3]);
                  $("#spo2_value").text(spo2_value);
                  spo2_values_history_to_report.push(spo2_value);
                })
                .catch((error) => console.error(error));
            }

            if (number_frames === maximum_number_frames_nibp) {
              let nibp_sys_encoder_values = [];
              let nibp_dia_encoder_values = [];
              let nibp_map_encoder_values = [];

              for (let second = 0; second < nibp_encoder_length; second++) {
                for (let channel in rgb_channel_data) {
                  let channel_data = rgb_channel_data[channel].slice(-maximum_number_frames_nibp);
                  let channel_data_in_second = channel_data.slice(second * fps, (second + 1) * fps);
                  let encoder_value = Math.round(_.mean(channel_data_in_second));
                  let nibp_sys_encoder_value =
                    (encoder_value - nibp_sys_scalers[channel].center) / nibp_sys_scalers[channel].scale;
                  let nibp_dia_encoder_value =
                    (encoder_value - nibp_dia_scalers[channel].center) / nibp_dia_scalers[channel].scale;
                  let nibp_map_encoder_value =
                    (encoder_value - nibp_map_scalers[channel].center) / nibp_map_scalers[channel].scale;
                  nibp_sys_encoder_values.push(nibp_sys_encoder_value);
                  nibp_dia_encoder_values.push(nibp_dia_encoder_value);
                  nibp_map_encoder_values.push(nibp_map_encoder_value);
                }
              }

              const typed_nibp_sys_encoder_values = Float32Array.from(nibp_sys_encoder_values);
              const tensor_nibp_sys_encoder_values = new ort.Tensor(
                "float32",
                typed_nibp_sys_encoder_values,
                [1, 41, 3]
              );
              const typed_nibp_sys_encoder_lengths = BigInt64Array.from([BigInt(nibp_encoder_length)]);
              const tensor_nibp_sys_encoder_lengths = new ort.Tensor("int64", typed_nibp_sys_encoder_lengths, [1]);
              const typed_nibp_sys_decoder_values = Float32Array.from(nibp_sys_encoder_values.slice(-3));
              const tensor_nibp_sys_decoder_values = new ort.Tensor(
                "float32",
                typed_nibp_sys_decoder_values,
                [1, 1, 3]
              );
              const typed_nibp_sys_decoder_lengths = BigInt64Array.from([BigInt(decoder_length)]);
              const tensor_nibp_sys_decoder_lengths = new ort.Tensor("int64", typed_nibp_sys_decoder_lengths, [1]);
              const typed_nibp_sys_target_scale = Float64Array.from(nibp_sys_target_scale);
              const tensor_nibp_sys_target_scale = new ort.Tensor("float64", typed_nibp_sys_target_scale, [1, 2]);

              const typed_nibp_dia_encoder_values = Float32Array.from(nibp_dia_encoder_values);
              const tensor_nibp_dia_encoder_values = new ort.Tensor(
                "float32",
                typed_nibp_dia_encoder_values,
                [1, 41, 3]
              );
              const typed_nibp_dia_encoder_lengths = BigInt64Array.from([BigInt(nibp_encoder_length)]);
              const tensor_nibp_dia_encoder_lengths = new ort.Tensor("int64", typed_nibp_dia_encoder_lengths, [1]);
              const typed_nibp_dia_decoder_values = Float32Array.from(nibp_dia_encoder_values.slice(-3));
              const tensor_nibp_dia_decoder_values = new ort.Tensor(
                "float32",
                typed_nibp_dia_decoder_values,
                [1, 1, 3]
              );
              const typed_nibp_dia_decoder_lengths = BigInt64Array.from([BigInt(decoder_length)]);
              const tensor_nibp_dia_decoder_lengths = new ort.Tensor("int64", typed_nibp_dia_decoder_lengths, [1]);
              const typed_nibp_dia_target_scale = Float64Array.from(nibp_dia_target_scale);
              const tensor_nibp_dia_target_scale = new ort.Tensor("float64", typed_nibp_dia_target_scale, [1, 2]);

              const typed_nibp_map_encoder_values = Float32Array.from(nibp_map_encoder_values);
              const tensor_nibp_map_encoder_values = new ort.Tensor(
                "float32",
                typed_nibp_map_encoder_values,
                [1, 41, 3]
              );
              const typed_nibp_map_encoder_lengths = BigInt64Array.from([BigInt(nibp_encoder_length)]);
              const tensor_nibp_map_encoder_lengths = new ort.Tensor("int64", typed_nibp_map_encoder_lengths, [1]);
              const typed_nibp_map_decoder_values = Float32Array.from(nibp_map_encoder_values.slice(-3));
              const tensor_nibp_map_decoder_values = new ort.Tensor(
                "float32",
                typed_nibp_map_decoder_values,
                [1, 1, 3]
              );
              const typed_nibp_map_decoder_lengths = BigInt64Array.from([BigInt(decoder_length)]);
              const tensor_nibp_map_decoder_lengths = new ort.Tensor("int64", typed_nibp_map_decoder_lengths, [1]);
              const typed_nibp_map_target_scale = Float64Array.from(nibp_map_target_scale);
              const tensor_nibp_map_target_scale = new ort.Tensor("float64", typed_nibp_map_target_scale, [1, 2]);

              const feeds_nibp_sys_inference_session = {
                [inputs_names_nibp_sys_inference_session[0]]: tensor_nibp_sys_encoder_values,
                [inputs_names_nibp_sys_inference_session[1]]: tensor_nibp_sys_encoder_lengths,
                [inputs_names_nibp_sys_inference_session[2]]: tensor_nibp_sys_decoder_values,
                [inputs_names_nibp_sys_inference_session[3]]: tensor_nibp_sys_decoder_lengths,
                [inputs_names_nibp_sys_inference_session[4]]: tensor_nibp_sys_target_scale,
              };

              const feeds_nibp_dia_inference_session = {
                [inputs_names_nibp_dia_inference_session[0]]: tensor_nibp_dia_encoder_values,
                [inputs_names_nibp_dia_inference_session[1]]: tensor_nibp_dia_encoder_lengths,
                [inputs_names_nibp_dia_inference_session[2]]: tensor_nibp_dia_decoder_values,
                [inputs_names_nibp_dia_inference_session[3]]: tensor_nibp_dia_decoder_lengths,
                [inputs_names_nibp_dia_inference_session[4]]: tensor_nibp_dia_target_scale,
              };

              const feeds_nibp_map_inference_session = {
                [inputs_names_nibp_map_inference_session[0]]: tensor_nibp_map_encoder_values,
                [inputs_names_nibp_map_inference_session[1]]: tensor_nibp_map_encoder_lengths,
                [inputs_names_nibp_map_inference_session[2]]: tensor_nibp_map_decoder_values,
                [inputs_names_nibp_map_inference_session[3]]: tensor_nibp_map_decoder_lengths,
                [inputs_names_nibp_map_inference_session[4]]: tensor_nibp_map_target_scale,
              };

              let nibp_inference_session_run = [
                nibp_sys_inference_session.run(feeds_nibp_sys_inference_session),
                nibp_dia_inference_session.run(feeds_nibp_dia_inference_session),
                nibp_map_inference_session.run(feeds_nibp_map_inference_session),
              ];

              Promise.all(nibp_inference_session_run)
                .then(([nibp_sys_result, nibp_dia_result, nibp_map_result]) => {
                  if ($("#div_nibp_value").hasClass("d-none")) {
                    $("#div_nibp_value").next("span.spinner-border").addClass("d-none");
                    $("#div_nibp_value").removeClass("d-none");
                    $("#div_nibp_value").addClass("d-block");
                  }
                  let nibp_sys_prediction = Math.round(nibp_sys_result.prediction.data[3]);
                  let nibp_dia_prediction = Math.round(nibp_dia_result.prediction.data[3]);
                  let nibp_map_prediction = Math.round(nibp_map_result.prediction.data[3]);
                  nibp_sys_dia_to_report = nibp_sys_prediction + " / " + nibp_dia_prediction;
                  nibp_map_to_report = "(" + nibp_map_prediction + ")";
                  $("#nibp_sys_dia_value").text(nibp_sys_dia_to_report);
                  $("#nibp_map_value").text(nibp_map_to_report);
                })
                .catch((error) => console.error(error));
            }
          } else {
            fps_history_to_set_fps.push(fpsControl.g[fpsControl.g.length - 1]);
            if (number_frames === initial_maximum_number_frames) {
              fps = Math.round(_.mean(fps_history_to_set_fps));
              maximum_number_frames_hr_spo2 = fps * hr_spo2_encoder_length;
              maximum_number_frames_nibp = fps * nibp_encoder_length;
              fps_setted = true;
            }
          }

          number_frames += 1;
        }

        let face_coordinates = get_face_coordinates(results.detections[0].boundingBox, canvasCtx.canvas);

        // draw corners of face detected
        canvasCtx.beginPath();
        canvasCtx.lineWidth = "4";
        canvasCtx.strokeStyle = "blue";

        // top-left
        canvasCtx.moveTo(face_coordinates.x1, face_coordinates.y1);
        canvasCtx.lineTo(face_coordinates.x1, face_coordinates.y1 + 20);
        canvasCtx.moveTo(face_coordinates.x1, face_coordinates.y1);
        canvasCtx.lineTo(face_coordinates.x1 + 20, face_coordinates.y1);

        // top-right
        canvasCtx.moveTo(face_coordinates.x2, face_coordinates.y1);
        canvasCtx.lineTo(face_coordinates.x2, face_coordinates.y1 + 20);
        canvasCtx.moveTo(face_coordinates.x2, face_coordinates.y1);
        canvasCtx.lineTo(face_coordinates.x2 - 20, face_coordinates.y1);

        // bottom-left
        canvasCtx.moveTo(face_coordinates.x1, face_coordinates.y2);
        canvasCtx.lineTo(face_coordinates.x1 + 20, face_coordinates.y2);
        canvasCtx.moveTo(face_coordinates.x1, face_coordinates.y2);
        canvasCtx.lineTo(face_coordinates.x1, face_coordinates.y2 - 20);

        // bottom-right
        canvasCtx.moveTo(face_coordinates.x2, face_coordinates.y2);
        canvasCtx.lineTo(face_coordinates.x2, face_coordinates.y2 - 20);
        canvasCtx.moveTo(face_coordinates.x2, face_coordinates.y2);
        canvasCtx.lineTo(face_coordinates.x2 - 20, face_coordinates.y2);

        canvasCtx.stroke();

        // draw rectangle roi
        canvasCtx.beginPath();
        canvasCtx.lineWidth = "4";
        canvasCtx.strokeStyle = "green";
        canvasCtx.rect(...Object.values(roi_rectangle));
        canvasCtx.stroke();
      }

      frame.delete();

      canvasCtx.restore();
    });

    // Present a control panel through which the user can manipulate the solution options.
    new ControlPanel(controlsElement, {
      selfieMode: true,
      model: "short",
      minDetectionConfidence: 0.7,
    })
      .add([
        fpsControl,
        new Toggle({ title: "Selfie Mode", field: "selfieMode" }),
        new SourcePicker({
          onSourceChanged: () => {
            faceDetection.reset();
          },
          onFrame: async (input, size) => {
            /* const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
              height = (window.innerHeight - 64) * 0.8; //-64px del navbar *0.8 (80% de la altura)
              width = height / aspect;
            } else {
              width = window.innerWidth;
              height = width * aspect;
            }
            canvasElement.width = width;
            canvasElement.height = height; */
            const width = $(".output-canvas-container").width();
            const height = $(".output-canvas-container").height();
            canvasElement.width = width > 0 ? width : 50;
            canvasElement.height = height > 0 ? height : 40;
            await faceDetection.send({ image: input });
          },
          examples: {
            images: [],
            videos: [],
          },
        }),
        /* new Slider({
          title: "F. D. Model Selection",
          field: "model",
          discrete: { short: "Short-Range", full: "Full-Range" },
        }),
        new Slider({
          title: "Min Face Detection Confidence",
          field: "minDetectionConfidence",
          range: [0, 1],
          step: 0.01,
        }), */
      ])
      .on((x) => {
        const options = x;
        videoElement.classList.toggle("selfie", options.selfieMode);
        faceDetection.setOptions(options);
      });
  }, []);

  return (
    <div className="app" style={{ backgroundImage: `url(${imageBackground})` }}>
      <Navbar />
      {!start && <Presentation clickStart={handleClickStart} />}
      <div id="main">
        <div className="d-flex row h-95">
          <div id="div_camera" className="col-8 h-100">
            <video className="input_video"></video>
            <div className="output-canvas-container position-relative">
              <canvas className="output_canvas"></canvas>
              <div className="loading">
                <div className="spinner"></div>
                <div className="message">Cargando ...</div>
              </div>
            </div>
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul>
                <li> Keep your face facing the camera. </li>
                <li>Keep a distance no greater than 3 meters and no less than 50 centimeters from the camera.</li>
                <li>Remove your hair or any type of hat to clear your forehead.</li>
              </ul>
            </div>
          </div>
          <div id="div_vital_signs" className="col-4">
            <div>
              <button type="button" className="btn btn-primary" id="button_process_vital_signs_detections">
                <i className="bi bi-play-fill"></i> Vital signs detection
              </button>
            </div>
            <div id="div_vital_signs_values">
              <div>
                <div>
                  <div className="card text-center h-100">
                    <div className="card-header">Heart Rate</div>
                    <div className="card-body">
                      <div className="d-none" id="div_hr_value">
                        <h5 className="card-title text-black" id="hr_value"></h5>
                        <p className="card-text">bpm</p>
                      </div>
                      <span className="spinner-border" role="status" aria-hidden="true"></span>
                    </div>
                    <div className="card-footer text-muted">
                      <i className="bi bi-heart-pulse"></i>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="card text-center h-100">
                    <div className="card-header">Oxygen Saturation</div>
                    <div className="card-body">
                      <div className="d-none" id="div_spo2_value">
                        <h5 className="card-title text-black" id="spo2_value"></h5>
                        <p className="card-text">SpO2 %</p>
                      </div>
                      <span className="spinner-border" role="status" aria-hidden="true"></span>
                    </div>
                    <div className="card-footer text-muted">
                      <img width="16" height="20" src="./images/oxygen_saturation_icon.png" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="card text-center h-100">
                    <div className="card-header">Blood Pressure</div>
                    <div className="card-body">
                      <div className="d-none" id="div_nibp_value">
                        <div className="row">
                          <h5 className="card-title text-black" id="nibp_sys_dia_value"></h5>
                        </div>
                        <div className="row">
                          <p className="card-text" id="nibp_map_value"></p>
                        </div>
                        <p className="card-text">mmHg</p>
                      </div>
                      <span className="spinner-border" role="status" aria-hidden="true"></span>
                    </div>
                    <div className="card-footer text-muted">
                      <img width="16" height="20" src="./images/blood_pressure_icon.jpg" />
                    </div>
                  </div>
                </div>
              </div>
              <canvas id="canvasOutput" width="512" height="512" className="d-none"></canvas>
            </div>
          </div>
        </div>
        <div className="progress-bar-container">
          <div id="video_progress_bar" className="progress d-none">
            <div
              className="progress-bar"
              role="progressbar"
              aria-label="Video progress bar"
              aria-valuenow="0"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </div>
      </div>
      {/* modal 
        <div
          className="modal fade"
          id="modal_report_vital_signs"
          tabIndex="-1"
          aria-labelledby="Modal report vital signs"
          aria-hidden="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="exampleModalLabel">
                  Report vital signs
                </h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body container">
                <div className="row">
                  <div className="col-xs-12 col-sm-6 col-md-6">
                    <span id="date_report_vital_signs"></span> |<span id="time_report_vital_signs"></span>
                  </div>
                </div>
                <div className="row">
                  <div className="col-xs-12 col-sm-12 col-md-6 col-lg-4 my-1">
                    <div className="card text-center h-100">
                      <div className="card-header">Heart Rate (avg)</div>
                      <div className="card-body">
                        <h5 className="card-title text-black" id="hr_value_report_vital_signs"></h5>
                        <p className="card-text">bpm</p>
                      </div>
                      <div className="card-footer text-muted">
                        <i className="bi bi-heart-pulse"></i>
                      </div>
                    </div>
                  </div>
                  <div className="col-xs-12 col-sm-12 col-md-6 col-lg-4 my-1">
                    <div className="card text-center h-100">
                      <div className="card-header">Oxygen Saturation (avg)</div>
                      <div className="card-body">
                        <h5 className="card-title text-black" id="spo2_value_report_vital_signs"></h5>
                        <p className="card-text">SpO2 %</p>
                      </div>
                      <div className="card-footer text-muted">
                        <img width="16" height="20" src="./images/oxygen_saturation_icon.png" />
                      </div>
                    </div>
                  </div>
                  <div className="col-xs-12 col-sm-12 col-md-6 col-lg-4 my-1">
                    <div className="card text-center h-100">
                      <div className="card-header">Blood Pressure</div>
                      <div className="card-body">
                        <div className="row">
                          <h5 className="card-title text-black" id="nibp_sys_dia_value_report_vital_signs"></h5>
                        </div>
                        <div className="row">
                          <p className="card-text" id="nibp_map_value_report_vital_signs"></p>
                        </div>
                        <p className="card-text">mmHg</p>
                      </div>
                      <div className="card-footer text-muted">
                        <img width="16" height="20" src="./images/blood_pressure_icon.jpg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer"></div>
            </div>
          </div>
        </div>*/}
      <div className="semi-ellipse lef-bottom" />
      <div className="semi-ellipse right-top" />
    </div>
  );
}

export default App;
