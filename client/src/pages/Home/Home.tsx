import { useCallback, useEffect, useState } from "react";
import { useHeartbeat } from "../../hooks/useHeartbeat";       //!!HeartBeat
import { useCameraQueue } from "../../hooks/useCameraQueue";
import ZoomControl from "../../components/UI/CameraZoom/ZoomControl";
import Joystick from "../../components/UI/Joystick/Joystick";
import PresetStream from "../../components/UI/PresetStream/PresetStream";
import Switch from "../../components/UI/Switch/Switch";
import { PresetTypes, type PresetItem } from "../../types/stream";
import styles from "./style.module.scss";
import type { ZoomValues } from "../../types/zoom";
import type { ClickType } from "../../types/joystik";
import notificationStore from "../../store/notificationStore";
import { getCameraDelta, handlerAxiosError, sleep } from "../../utils/func";
import { AnimatePresence, motion } from "framer-motion";
import { moveCamera, setPreset, setTvState, stopCamera } from "../../http/cameraAPI";

const presets: PresetItem[] = [
  {
    text: "Большая/малая операционные Quad>",
    type: PresetTypes.first,
  },
  {
    text: "Большая операционная Preset2",
    type: PresetTypes.second,
  },
  {
    text: "Малая операционная Preset3",
    type: PresetTypes.third,
  },
  {
    text: "Большая операционная Preset4",
    type: PresetTypes.fourth,
  },
];
const Home = () => {
  const [tvSwitchDisabled, setTvSwitchDisabled] = useState(false);
  const { setNotification } = notificationStore();
  const [deletingPreset, setDeletingPreset] = useState<null | PresetItem>(null);
  const [currentPreset, setCurrentPreset] = useState({
    text: "Большая/малая операционные Quad",
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
  const { isOnline, lastPing, reconnect } = useHeartbeat(15000);  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!HeartBeat

  const camera1Control = useCameraQueue("cam1"); //Создаем контроллеры для камер
  const camera2Control = useCameraQueue("cam2");

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

  const setPresetHandler = useCallback(async () => {
    try {
      await setPreset(currentPreset.type);
    } catch (error) {
      console.log(error);
      setNotification({
        text: handlerAxiosError(error),
        type: "error",
        visible: true,
      });
    }
  }, [setNotification, currentPreset]);

  useEffect(() => {
    setPresetHandler()
  }, [setPresetHandler]);

  useEffect(() => {
    camera1Control.handleZoom(smallOperationZoom);
  }, [smallOperationZoom, camera1Control.handleZoom]);
  useEffect(() => {
    camera2Control.handleZoom(largeOperationZoom);
  }, [largeOperationZoom, camera2Control.handleZoom]);
  useEffect(() => {
    camera1Control.handleMove(smallOperationIsPressed);
  }, [smallOperationIsPressed, camera1Control.handleMove]);
  useEffect(() => {
    camera2Control.handleMove(largeOperationIsPressed);
  }, [largeOperationIsPressed, camera2Control.handleMove]);

  const setTvValueHandler = useCallback(
    async (v: boolean) => {
      try {
        setTvSwitchDisabled(true);
        await setTvState(v ? "on" : "off")
        setTvIsOn(v);
      } catch (error) {
        setNotification({
          visible: true,
          type: "error",
          text: handlerAxiosError(error),
        });
      } finally {
        setTvSwitchDisabled(false)
      }
    },
    [setNotification]
  );

  useEffect(() => {
    setTvValueHandler(true)
    return () => {
      setTvValueHandler(false)
    }
  }, [setTvValueHandler])

  return (
    <div className={styles.wrapper}>
      {/* Проверяем статус и пишем статус и соединение с сервером */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        padding: '8px 12px',
        backgroundColor: isOnline ? '#4CAF50' : '#f44336',
        color: 'white',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 1000,
        fontFamily: 'Arial, sans-serif'
      }}>
        {isOnline ? '🟢 Онлайн' : '🔴 Оффлайн'}
        {lastPing && (
          <div style={{ fontSize: '10px', marginTop: '2px' }}>
            {lastPing.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Модальное окно при потере связи */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '30px',
          borderRadius: '12px',
          textAlign: 'center',
          zIndex: 1001,
          minWidth: '300px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>⚠️ Потеря связи с сервером</h3>
          <p style={{ margin: '10px 0' }}>Попытка переподключения...</p>
          <button
            onClick={reconnect}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Переподключиться вручную
          </button>
        </div>
      )}
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
