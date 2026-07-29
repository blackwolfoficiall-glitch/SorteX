export type VerificationStatus =
  | "INCOMPLETE"
  | "PENDING"
  | "UNDER_REVIEW"
  | "CORRECTION_REQUESTED"
  | "DOCUMENT_REQUESTED"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED"
  | "BLOCKED"
  | "CLOSED";

export type OrganizerDocumentType =
  | "IDENTITY"
  | "ADDRESS_PROOF"
  | "CNPJ_DOCUMENT";

export type OrganizerPlan =
  | "BASIC"
  | "PROFESSIONAL"
  | "PREMIUM"
  | "ENTERPRISE";

export type OrganizerDocument = {
  id: string;
  type: OrganizerDocumentType;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  fileUrl: string;
  status?: string;
  version?: number;
  reviewNote?: string | null;
};

export type OrganizerProfile = {
  id: string;
  userId: string;
  fullName: string;
  cpf: string;
  phone: string;
  birthDate: string | null;
  organizationName: string | null;
  cnpj: string | null;
  instagram: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  municipalityCode: string | null;
  addressReference: string | null;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  publicReviewMessage?: string | null;
  correctionDeadline?: string | null;
  submittedAt: string | null;
  updatedAt: string;
  reviewedAt: string | null;
  currentPlan: OrganizerPlan;
  platformFee: number;
  monthlyFee: number;
  firstCampaignFree: boolean;
  platformFeeWaived: boolean;
  monthlyFeeWaived: boolean;
  customPlatformFee: number | null;
  founder: boolean;
  vip: boolean;
  campaignsBlocked: boolean;
  paymentsBlocked: boolean;
  readOnlyAccess?: boolean;
  documents: OrganizerDocument[];
  user: {
    id: string;
    name: string;
    email: string;
    verified: boolean;
    isActive: boolean;
  };
};

export type OrganizerListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  verified: boolean;
  isActive: boolean;
  createdAt: string;
  organizerProfile: OrganizerProfile | null;
};
