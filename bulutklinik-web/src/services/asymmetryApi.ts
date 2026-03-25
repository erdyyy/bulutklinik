/**
 * BulutKlinik AI Servis — asimetri analizi ve tedavi planı API client.
 * Base URL: http://localhost:8001/api/v1
 */

import axios from "axios";

const aiApi = axios.create({
  baseURL: "http://localhost:8001/api/v1",
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
  photo_id:   number;
  patient_id: number;
  file_name:  string;
  width:      number;
  height:     number;
  file_size:  number;
  photo_type: string;
  created_at: string;
}

export interface AsymmetryResult {
  analysis_id: number;
  photo_id:    number;
  patient_id:  number;
  px_per_mm:   number;

  eyebrow_left_height_px:  number;
  eyebrow_right_height_px: number;
  eyebrow_delta_mm:        number;

  eye_left_opening_px:  number;
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
}

export interface RegionalFinding {
  region:   string;
  finding:  string;
  severity: "none" | "mild" | "moderate" | "severe";
}

export interface Recommendation {
  treatment:       string;
  region:          string;
  priority:        "high" | "medium" | "low";
  estimated_units: string | null;
  notes:           string;
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
  is_approved:  boolean;
  created_at:   string;
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
  photoId:     number,
  pixelPerMm?: number,
): Promise<AsymmetryResult> => {
  const { data } = await aiApi.post<AsymmetryResult>("/analysis/analyze-asymmetry", {
    photo_id:     photoId,
    pixel_per_mm: pixelPerMm ?? null,
  });
  return data;
};

export const generateTreatmentPlan = async (params: {
  analysisId:   number;
  patientAge?:  number;
  patientNotes?: string;
  doctorNotes?:  string;
}): Promise<TreatmentPlanResponse> => {
  const { data } = await aiApi.post<TreatmentPlanResponse>("/treatment/generate-treatment-plan", {
    analysis_id:   params.analysisId,
    patient_age:   params.patientAge ?? null,
    patient_notes: params.patientNotes ?? null,
    doctor_notes:  params.doctorNotes ?? null,
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
