const hr_scalers = {
  r_channel: { center: 161.2667, scale: 27.802 },
  g_channel: { center: 117.7234, scale: 29.2359 },
  b_channel: { center: 99.6792, scale: 28.2883 },
};
const spo2_scalers = {
  r_channel: { center: 161.3803, scale: 27.6925 },
  g_channel: { center: 117.932, scale: 29.0508 },
  b_channel: { center: 99.8252, scale: 28.1356 },
};
const nibp_sys_scalers = {
  r_channel: { center: 159.0824, scale: 28.4067 },
  g_channel: { center: 115.3683, scale: 29.8183 },
  b_channel: { center: 97.5078, scale: 28.7077 },
};
const nibp_dia_scalers = {
  r_channel: { center: 158.6667, scale: 27.9325 },
  g_channel: { center: 114.9894, scale: 29.3459 },
  b_channel: { center: 97.208, scale: 28.3594 },
};
const nibp_map_scalers = {
  r_channel: { center: 159.0897, scale: 28.3984 },
  g_channel: { center: 115.3417, scale: 29.8104 },
  b_channel: { center: 97.5721, scale: 28.6972 },
};

const hr_target_scale = [76.3433, 13.6168];
const spo2_target_scale = [97.6552, 1.4472];
const nibp_sys_target_scale = [128.8523, 23.971];
const nibp_dia_target_scale = [71.9233, 13.0855];
const nibp_map_target_scale = [93.5987, 14.8594];

export {
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
};
