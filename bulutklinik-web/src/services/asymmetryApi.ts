/**
 * Medica.AI AI Servis — asimetri analizi ve tedavi planı API client.
 * Base URL: http://localhost:8001/api/v1
 */

import axios from "axios";

const aiApi = axios.create({
  baseURL: import.meta.env.VITE_AI_URL ?? "/ai/api/v1",
  timeout: 60_000,   // OpenCV + OpenAI birlikte ~30s sürebilir
});

// C# backend token'ını AI servise de gönder
aiApi.interceptors.request.use((config) => {
  const raw = localStorage.getItem("auth-storage");
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
    } catch (_) {}
  }
  return config;
});

// ─── Types ───────────────────────────────────────────────────────────────── //

export interface PhotoUploadResponse {
  photo_id:   string;
  patient_id: number;
  file_name:  string;
  width:      number;
  height:     number;
  file_size:  number;
  photo_type: string;
  created_at: string;
}

// ─── Yeni estetik metrik tipleri ─────────────────────────────────────────── //

export interface GoldenRatioMetrics {
  facial_thirds_upper:        number;   // 0-1 oran
  facial_thirds_middle:       number;
  facial_thirds_lower:        number;
  thirds_score:               number;   // 0-100
  eye_width_to_face_ratio:    number;   // ideal ~0.50
  nose_width_to_icw_ratio:    number;   // ideal ~1.0
  upper_lower_lip_ratio:      number;   // ideal ~0.6
  face_width_to_height_ratio: number;
  golden_ratio_score:         number;   // 0-100
  phi_deviations:             Record<string, number>;
}

export interface CanthalTiltMetrics {
  left_tilt_deg:      number;
  right_tilt_deg:     number;
  avg_tilt_deg:       number;
  tilt_symmetry_diff: number;
  classification:     string;
}

export interface FaceShapeResult {
  shape:              string;   // oval/yuvarlak/kare/kalp/elmas/dikdörtgen
  shape_en:           string;
  confidence:         number;
  forehead_width_mm:  number;
  cheekbone_width_mm: number;
  jaw_width_mm:       number;
  face_length_mm:     number;
  ratios:             Record<string, number>;
}

export interface VolumeMapMetrics {
  temporal_hollowing:   number;   // 0-10
  malar_fullness:       number;
  tear_trough_depth:    number;
  nasolabial_depth:     number;
  overall_volume_score: number;   // 0-100
  age_indicator:        string;   // "genç" | "orta" | "olgun"
}

export interface WrinkleMapMetrics {
  forehead_score:       number;   // 0-10
  glabellar_score:      number;
  crows_feet_score:     number;
  nasolabial_score:     number;
  overall_score:        number;   // 0-100
  dominant_zone:        string;
  botox_priority_zones: string[];
}

export interface NasalMetrics {
  nasolabial_angle_deg: number;
  nose_width_mm:        number;
  nose_length_mm:       number;
  nose_width_to_length: number;
  nose_to_face_width:   number;
  tip_projection:       number;
  dorsum_deviation_mm:  number;
  assessment:           string;
}

export interface AsymmetryResult {
  analysis_id: number;
  photo_id:    string;
  patient_id:  number;
  px_per_mm:   number;

  eyebrow_left_height_px:  number;
  eyebrow_right_height_px: number;
  eyebrow_delta_mm:        number;

  eye_left_opening_px:  number;
  // Head pose
  pose_warnings: string[];
  pitch_deg:     number | null;
  yaw_deg:       number | null;
  roll_deg:      number | null;
  eye_right_opening_px: number;
  eye_delta_mm:         number;

  lip_left_height_px:  number;
  lip_right_height_px: number;
  lip_delta_mm:        number;

  nose_deviation_mm:    number;
  midline_deviation_mm: number;
  symmetry_score:       number;

  annotated_image_b64: string | null;
  status:     string;
  created_at: string;

  // Yeni estetik metrikler
  golden_ratio:  GoldenRatioMetrics  | null;
  canthal_tilt:  CanthalTiltMetrics  | null;
  face_shape:    FaceShapeResult     | null;
  volume_map:    VolumeMapMetrics    | null;
  wrinkle_map:   WrinkleMapMetrics   | null;
  nasal_metrics: NasalMetrics        | null;
}

export interface RegionalFinding {
  region:   string;
  finding:  string;
  severity: "none" | "mild" | "moderate" | "severe";
}

export interface Recommendation {
  treatment:       string;
  region:          string;
  target_muscle?:  string;   // hedeflenen kas adı
  priority:        "high" | "medium" | "low";
  estimated_units: string | null;
  notes:           string;
}

export interface TreatmentPin {
  idx:             number;
  x_pct:           number;   // görüntü genişliğinin % değeri
  y_pct:           number;   // görüntü yüksekliğinin % değeri
  treatment:       string;
  target_muscle:   string;
  region:          string;
  estimated_units: string;
  notes:           string;
  priority:        "high" | "medium" | "low";
  color_hex:       string;   // "#rrggbb"
}

export interface TreatmentPlanResponse {
  plan_id:    number;
  analysis_id: number;
  patient_id: number;
  clinical_summary:         string;
  regional_findings:        RegionalFinding[];
  recommendations:          Recommendation[];
  contraindications:        string | null;
  patient_communication:    string;
  follow_up_interval_weeks: number;
  ai_model:          string;
  prompt_tokens:     number;
  completion_tokens: number;
  is_approved:        boolean;
  created_at:         string;
  treatment_map_b64?: string | null;   // AI tedavi haritası görüntüsü
  treatment_pins?:    TreatmentPin[] | null;  // HTML tooltip pin koordinatları
}

export interface InjectionPoint {
  id:           number;
  analysis_id:  number;
  region:       string;
  side:         string;
  x_normalized: number;
  y_normalized: number;
  product_name: string | null;
  dosage_units: number | null;
  notes:        string | null;
  created_at:   string;
}

// ─── API fonksiyonları ───────────────────────────────────────────────────── //

export const uploadPhoto = async (
  file:       File,
  patientId:  number,
  doctorId:   number,
  photoType:  "before" | "after" | "analysis" = "before",
): Promise<PhotoUploadResponse> => {
  const form = new FormData();
  form.append("file",       file);
  form.append("patient_id", String(patientId));
  form.append("doctor_id",  String(doctorId));
  form.append("photo_type", photoType);
  const { data } = await aiApi.post<PhotoUploadResponse>("/photos/upload-photo", form);
  return data;
};

export const analyzeAsymmetry = async (
  photoId:   string,
  patientId: number = 0,
): Promise<AsymmetryResult> => {
  const form = new FormData();
  form.append("photo_id",   photoId);
  form.append("patient_id", String(patientId));
  const { data } = await aiApi.post<AsymmetryResult>("/photos/analyze-asymmetry", form);
  return data;
};

export const generateTreatmentPlan = async (params: {
  analysisId:          number;
  patientAge?:         number;
  patientNotes?:       string;
  doctorNotes?:        string;
  photoId?:            string;
  patientId?:          number;
  metrics?:            Record<string, unknown>;
  annotatedImageB64?:  string | null;
  profileImageB64?:    string | null;   // Lateral/profil fotoğraf
}): Promise<TreatmentPlanResponse> => {
  const { data } = await aiApi.post<TreatmentPlanResponse>("/photos/generate-treatment-plan", {
    photo_id:             params.photoId           ?? String(params.analysisId),
    patient_id:           params.patientId         ?? 0,
    metrics:              params.metrics           ?? {},
    doctor_notes:         params.doctorNotes       ?? null,
    annotated_image_b64:  params.annotatedImageB64 ?? null,
    profile_image_b64:    params.profileImageB64   ?? null,
    patient_age:          params.patientAge        ?? null,
  });
  return data;
};

export const approveTreatmentPlan = async (
  planId:   number,
  doctorId: number,
): Promise<TreatmentPlanResponse> => {
  const { data } = await aiApi.patch<TreatmentPlanResponse>(
    `/treatment/${planId}/approve`,
    { doctor_id: doctorId },
  );
  return data;
};

export const addInjectionPoint = async (point: {
  analysisId:  number;
  patientId:   number;
  doctorId:    number;
  region:      string;
  side:        "left" | "right" | "bilateral";
  xNorm:       number;
  yNorm:       number;
  productName?: string;
  dosageUnits?: number;
  notes?:       string;
}): Promise<InjectionPoint> => {
  const { data } = await aiApi.post<InjectionPoint>(
    `/analysis/${point.analysisId}/injection-points`,
    {
      analysis_id:  point.analysisId,
      patient_id:   point.patientId,
      doctor_id:    point.doctorId,
      region:       point.region,
      side:         point.side,
      x_normalized: point.xNorm,
      y_normalized: point.yNorm,
      product_name: point.productName,
      dosage_units: point.dosageUnits,
      notes:        point.notes,
    },
  );
  return data;
};

export const listInjectionPoints = async (analysisId: number): Promise<InjectionPoint[]> => {
  const { data } = await aiApi.get<InjectionPoint[]>(`/analysis/${analysisId}/injection-points`);
  return data;
};
