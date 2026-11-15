import { AbsoluteFill, Composition } from "remotion";
import { DEFAULT_BRAND_CONFIG } from "./brand";
import {
  BrandChrome,
  calculateShortInfoMetadata,
  KineticFullCard,
  ShortInfo,
  type ShortInfoProps,
} from "./ShortInfo";

const BrandPreview: React.FC = () => {
  const sampleWords = [
    { text: "Primero", fromMs: 0, toMs: 400 },
    { text: "va", fromMs: 400, toMs: 700 },
    { text: "el", fromMs: 700, toMs: 900 },
    { text: "diseño,", fromMs: 900, toMs: 1400 },
    { text: "luego", fromMs: 1400, toMs: 1800 },
    { text: "la", fromMs: 1800, toMs: 2000 },
    { text: "tecnología.", fromMs: 2000, toMs: 2800 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: DEFAULT_BRAND_CONFIG.colors.bgDark }}>
      <KineticFullCard
        allWords={sampleWords}
        scene={{
          id: 1,
          text: "Primero va el diseño, luego la tecnología.",
          startMs: 0,
          endMs: 3000,
          mode: "kinetic",
          emphasis: ["diseño", "tecnología"],
        }}
        brand={DEFAULT_BRAND_CONFIG}
      />
      <BrandChrome brand={DEFAULT_BRAND_CONFIG} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="BrandPreview"
      component={BrandPreview}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="ShortInfo"
      component={ShortInfo}
      calculateMetadata={calculateShortInfoMetadata}
      defaultProps={
        {
          music: null,
          audio: "voice.clean.wav",
          camera: "camera.clean.mp4",
          captions: [],
          scenes: [],
          brand: DEFAULT_BRAND_CONFIG,
        } satisfies ShortInfoProps
      }
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
