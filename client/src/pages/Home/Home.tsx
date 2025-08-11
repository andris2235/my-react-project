import { useCallback, useEffect, useState } from "react";
import ZoomControl from "../../components/UI/CameraZoom/ZoomControl";
import Joystick from "../../components/UI/Joystick/Joystick";
import PresetStream from "../../components/UI/PresetStream/PresetStream";
import Switch from "../../components/UI/Switch/Switch";
import { PresetTypes, type PresetItem } from "../../types/stream";
import styles from "./style.module.scss";
import type { ZoomValues } from "../../types/zoom";
import type { ClickType } from "../../types/joystik";
// import MyLoader from "../../components/UI/MyLoader";
import notificationStore from "../../store/notificationStore";
import { getCameraDelta, handlerAxiosError, sleep } from "../../utils/func";
import { AnimatePresence, motion } from "framer-motion";
import { moveCamera, stopCamera } from "../../http/cameraAPI";
// import { getStreams, getTvState } from "../../http/cameraAPI";

const presets: PresetItem[] = [
  {
    text: "Эндоскоп 1, Эндоскоп 2, Большая операционная, Малая операционная",
    type: PresetTypes.first,
  },
  {
    text: "Эндоскоп 1, Большая операционная",
    type: PresetTypes.second,
  },
  {
    text: "Эндоскоп 2, Малая операционная",
    type: PresetTypes.third,
  },
  {
    text: "Эндоскоп 1, Большая операционная, малая операционная",
    type: PresetTypes.fourth,
  },
];
const Home = () => {
  // const [loading, setLoading] = useState(true);
  const [tvSwitchDisabled, setTvSwitchDisabled] = useState(false);
  const { setNotification } = notificationStore();
  // const isZoomProcessing = useRef(false);
  const [deletingPreset, setDeletingPreset] = useState<null | PresetItem>(null);
  // const isPositionProcessing = useRef(false);
  const [currentPreset, setCurrentPreset] = useState({
    text: "Эндоскоп 1, Эндоскоп 2, Большая операционная, Малая операционная",
    type: PresetTypes.first,
  });
  const [otherPresets, setOtherPresets] = useState<PresetItem[]>(
    presets.filter((i) => i.type !== PresetTypes.first)
  );
  const [smallOperationZoom, setSmallOperationZoom] =
    useState<ZoomValues>("neutral");
  const [largeOperationZoom, setLargeOperationZoom] =
    useState<ZoomValues>("neutral");
  const [smallOperationIsPressed, setSmallOperationIsPressed] =
    useState<null | ClickType>(null);
  const [largeOperationIsPressed, setLargeOperationIsPressed] =
    useState<null | ClickType>(null);
  const [tvIsOn, setTvIsOn] = useState(false);
  // const zoomIntervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  // const positionIntervalId = useRef<ReturnType<typeof setInterval> | null>(
  //   null
  // );

  const setCurrentPresetHandler = async (type: PresetTypes) => {
    const oldCurrent = { ...currentPreset };
    const current = presets.find((i) => i.type === type);
    if (!current) return;
    // resetStreams()
    setDeletingPreset(current);
    setCurrentPreset(current);
    await sleep(500);
    setOtherPresets((p) =>
      p.map((i) => (i.type === current.type ? oldCurrent : i))
    );
  };

  // useEffect(() => {
  //   zoomIntervalId.current = setInterval(async () => {
  //     try {
  //       if (isZoomProcessing.current) return;

  //       // Обработка small
  //       if (smallOperationZoom !== "neutral") {
  //         isZoomProcessing.current = true;
  //         console.log("Обработка small:", smallOperationZoom);
  //         isZoomProcessing.current = false;
  //         return; // ждём следующего тика, чтобы large пошёл строго после
  //       }

  //       // Обработка large
  //       if (largeOperationZoom !== "neutral") {
  //         isZoomProcessing.current = true;
  //         console.log("Обработка large:", largeOperationZoom);
  //         isZoomProcessing.current = false;
  //       }
  //     } catch (error) {
  //       console.log(error);
  //       setNotification({
  //         visible: true,
  //         type: "error",
  //         text: handlerAxiosError(error),
  //       });
  //     }
  //   }, 500);

  //   return () => {
  //     if (zoomIntervalId.current) clearInterval(zoomIntervalId.current);
  //   };
  // }, [smallOperationZoom, largeOperationZoom, setNotification]);
  console.log("smallOperationZoom", smallOperationZoom);
  console.log("largeOperationZoom", largeOperationZoom);
  console.log("smallOperationIsPressed", smallOperationIsPressed);
  console.log("largeOperationIsPressed", largeOperationIsPressed);

  const cameraZoomHandler = useCallback(
    async (zoom: ZoomValues, cam: "cam1" | "cam2") => {
      try {
        if (zoom === "neutral") {
          await stopCamera(cam);
        } else {
          await moveCamera(
            { x: 0, y: zoom === "down" ? -0.5 : 0.5, z: 0 },
            cam
          );
        }
      } catch (error) {
        console.log(error);
        setNotification({
          text: handlerAxiosError(error),
          type: "error",
          visible: true,
        });
      }
    },
    [setNotification]
  );

  const cameraMoveHandler = useCallback(
    async (pressed: ClickType | null, cam: "cam1" | "cam2") => {
      try {
        if (!pressed) {
          await stopCamera(cam);
        } else {
          await moveCamera(getCameraDelta(pressed), cam);
        }
      } catch (error) {
        console.log(error);
        setNotification({
          text: handlerAxiosError(error),
          type: "error",
          visible: true,
        });
      }
    },
    [setNotification]
  );

  useEffect(() => {
    cameraZoomHandler(smallOperationZoom, "cam1");
  }, [smallOperationZoom, cameraZoomHandler]);
  useEffect(() => {
    cameraZoomHandler(largeOperationZoom, "cam2");
  }, [largeOperationZoom, cameraZoomHandler]);

  useEffect(() => {
    cameraMoveHandler(smallOperationIsPressed, "cam1");
  }, [smallOperationIsPressed, cameraMoveHandler]);
  useEffect(() => {
    cameraMoveHandler(largeOperationIsPressed, "cam2");
  }, [largeOperationIsPressed, cameraMoveHandler]);

  // useEffect(() => {
  //   positionIntervalId.current = setInterval(async () => {
  //     try {
  //       if (isPositionProcessing.current) return;

  //       // Обработка small
  //       if (smallOperationIsPressed) {
  //         isPositionProcessing.current = true;
  //         console.log("Обработка small:", smallOperationIsPressed);
  //         isPositionProcessing.current = false;
  //         return; // ждём следующего тика, чтобы large пошёл строго после
  //       }

  //       // Обработка large
  //       if (largeOperationIsPressed) {
  //         isPositionProcessing.current = true;
  //         console.log("Обработка large:", largeOperationIsPressed);
  //         isPositionProcessing.current = false;
  //       }
  //     } catch (error) {
  //       console.log(error);
  //       setNotification({
  //         visible: true,
  //         type: "error",
  //         text: handlerAxiosError(error),
  //       });
  //     }
  //   }, 500);

  //   return () => {
  //     if (positionIntervalId.current) clearInterval(positionIntervalId.current);
  //   };
  // }, [largeOperationIsPressed, smallOperationIsPressed, setNotification]);

  const setTvValueHandler = useCallback(
    async (v: boolean) => {
      try {
        setTvSwitchDisabled(true);
        setTvIsOn(v);
        setTvSwitchDisabled(false);
      } catch (error) {
        setNotification({
          visible: true,
          type: "error",
          text: handlerAxiosError(error),
        });
      }
    },
    [setNotification]
  );

  // const firstFetch = useCallback(async () => {
  //   try {
  //     setLoading(false);
  //     // await getStreams({});
  //     // await getTvState({});
  //   } catch (error) {
  //     console.log(error);

  //     setNotification({
  //       visible: true,
  //       type: "error",
  //       text: handlerAxiosError(error),
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [setNotification]);

  // useEffect(() => {
  //   firstFetch();
  // }, [firstFetch]);

  // if (loading) {
  //   return <MyLoader />;
  // }

  return (
    <div className={styles.wrapper}>
      <div className={styles.managementBlock}>
        <div className={styles.tvManagement}>
          <div className={styles.tvManagement__left}>
            <div className={styles.tvManagement__left__icon}>
              <img src="/icons/desktop.png" alt="desktop" />
            </div>
            <div className={styles.tvManagement__left__text}>
              <span>
                <b>Телевизор</b>{" "}
              </span>
              <br />
              <span>Подключен</span>
            </div>
          </div>
          <Switch
            disabled={tvSwitchDisabled}
            on={tvIsOn}
            setOn={setTvValueHandler}
          />
        </div>
        <div className={styles.smallCamera}>
          <div className={styles.smallCamera__left}>
            <div className={styles.smallCamera__left__icon}>
              <img src="/icons/camera.png" alt="camera" />
            </div>
            <div className={styles.smallCamera__left__text}>
              <span>
                <b>Малая операционная</b>{" "}
              </span>
              <br />
              <span>Камера 1</span>
            </div>
          </div>
          <div className={styles.smallCamera__managing}>
            <ZoomControl
              direction={smallOperationZoom}
              setDirection={setSmallOperationZoom}
            />
            <Joystick
              isPressed={smallOperationIsPressed}
              setIsPressed={setSmallOperationIsPressed}
            />
          </div>
        </div>
        <div className={styles.smallCamera}>
          <div className={styles.smallCamera__left}>
            <div className={styles.smallCamera__left__icon}>
              <img src="/icons/camera.png" alt="camera" />
            </div>
            <div className={styles.smallCamera__left__text}>
              <span>
                <b>Большая операционная</b>{" "}
              </span>
              <br />
              <span>Камера 2</span>
            </div>
          </div>
          <div className={styles.smallCamera__managing}>
            <ZoomControl
              direction={largeOperationZoom}
              setDirection={setLargeOperationZoom}
            />
            <Joystick
              isPressed={largeOperationIsPressed}
              setIsPressed={setLargeOperationIsPressed}
            />
          </div>
        </div>
      </div>
      <div className={styles.cameraBlock}>
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            key={currentPreset.type}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.5 }}
            className={styles.cameraBlock__current}
          >
            <div className={styles.cameraBlock__current__hls}>
              <PresetStream preset={currentPreset.type} />
            </div>

            <p>{currentPreset.text}</p>
          </motion.div>
        </AnimatePresence>
        <div className={styles.miniCameras}>
          {otherPresets.map((i) => (
            <motion.div
              key={i.type}
              onClick={() => setCurrentPresetHandler(i.type)}
              initial={
                deletingPreset?.type === i.type
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: -40 }
              }
              animate={
                deletingPreset?.type === i.type
                  ? { opacity: 0, y: 40 }
                  : { opacity: 1, y: 0 }
              }
              transition={{ duration: 0.4 }}
              className={styles.miniCameras__camera}
            >
              <div>
                <PresetStream preset={i.type} />
              </div>
              <p>{i.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
