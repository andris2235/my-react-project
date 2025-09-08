import { $host } from ".";
import type { SetCameraZoomBody } from "../types/bodies/camera";
import type { PresetTypes } from "../types/stream";
import type { TvState } from "../types/tv";
import { withRetry } from "./retryWrapper";

export const setTvState = async (item: TvState) => {
  return withRetry(async () => {
    const { data } = await $host.post(`api/stream/tv/${item}`, {}, { timeout: 15000 });
    return data;
  }, { maxRetries: 2 });
};

export const moveCamera = async (item: SetCameraZoomBody, cam: "cam1" | "cam2") => {
  return withRetry(async () => {
    const { data } = await $host.post(`api/stream/camera/${cam}/move`, item, { timeout: 10000 });
    return data;
  }, { maxRetries: 2 });
};

export const stopCamera = async (cam: "cam1" | "cam2") => {
  return withRetry(async () => {
    const { data } = await $host.post(`api/stream/camera/${cam}/stop`, {}, { timeout: 5000 });
    return data;
  }, { maxRetries: 1 }); // Для stop меньше повторов
};

export const setPreset = async (preset: PresetTypes) => {
  return withRetry(async () => {
    const { data } = await $host.post(`api/stream/preset/${preset}`, {}, { timeout: 20000 });
    return data;
  }, { maxRetries: 2 });
};

