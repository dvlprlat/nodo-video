export type BrandColors = {
  bgDark: string;
  bgDark2: string;
  bgLight: string;
  bgWhite: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textWhite: string;
  accent: string;
  accentLight: string;
  ruleDark: string;
  ruleLight: string;
};

export type BrandFontSpec = {
  family: string;
  file: string;
  weight: string;
  style?: string;
};

export type BrandAudioConfig = {
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolumeScale: number;
  cleanVideo?: {
    maxSilenceSec?: number;
    keptPauseSec?: number;
    breathBelowDb?: number;
  };
};

export type BrandConfig = {
  brandName: string;
  domain: string;
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  language: string;
  colors: BrandColors;
  fonts: {
    heading: BrandFontSpec;
    mono: BrandFontSpec;
  };
  audio: BrandAudioConfig;
};

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  brandName: "Kivra",
  domain: "kivra.com.mx",
  headerLeft: "Kivra · Arquitectura de Software e IA",
  headerRight: "DIAGNÓSTICO DE PROCESOS",
  footerLeft: "NEGOCIO ANTES QUE CÓDIGO",
  language: "es",
  colors: {
    bgDark: "#050816",
    bgDark2: "#0B1120",
    bgLight: "#F7F8FC",
    bgWhite: "#FFFFFF",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textTertiary: "#94A3B8",
    textMuted: "#64748B",
    textWhite: "#F8FAFC",
    accent: "#5570FF",
    accentLight: "#8EA0FF",
    ruleDark: "rgba(248, 250, 252, 0.15)",
    ruleLight: "rgba(15, 23, 42, 0.14)",
  },
  fonts: {
    heading: {
      family: "Manrope",
      file: "Manrope-Variable.ttf",
      weight: "100 900",
      style: "sans-serif",
    },
    mono: {
      family: "IBM Plex Mono",
      file: "IBMPlexMono-SemiBold.ttf",
      weight: "600",
    },
  },
  audio: {
    musicVolume: 0.1,
    sfxEnabled: true,
    sfxVolumeScale: 1.0,
    cleanVideo: {
      maxSilenceSec: 0.45,
      keptPauseSec: 0.18,
      breathBelowDb: 10,
    },
  },
};

export const mergeBrandConfig = (partial?: Partial<BrandConfig> | null): BrandConfig => {
  if (!partial) {
    return DEFAULT_BRAND_CONFIG;
  }
  return {
    ...DEFAULT_BRAND_CONFIG,
    ...partial,
    colors: {
      ...DEFAULT_BRAND_CONFIG.colors,
      ...(partial.colors ?? {}),
    },
    fonts: {
      heading: {
        ...DEFAULT_BRAND_CONFIG.fonts.heading,
        ...(partial.fonts?.heading ?? {}),
      },
      mono: {
        ...DEFAULT_BRAND_CONFIG.fonts.mono,
        ...(partial.fonts?.mono ?? {}),
      },
    },
    audio: {
      ...DEFAULT_BRAND_CONFIG.audio,
      ...(partial.audio ?? {}),
      cleanVideo: {
        ...DEFAULT_BRAND_CONFIG.audio.cleanVideo,
        ...(partial.audio?.cleanVideo ?? {}),
      },
    },
  };
};
