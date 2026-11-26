export type AppRole = "BUYER" | "ORGANIZER";
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AppRole | "ADMIN";
  city?: string | null;
  state?: string | null;
}
export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
export interface Session extends Tokens {
  user: User;
}
export interface Municipality {
  id: string;
  name: string;
}
export interface Registration {
  role: AppRole;
  personType?: "PF" | "PJ";
  name: string;
  cpf: string;
  cnpj?: string;
  organizationName?: string;
  fantasyName?: string;
  birthDate?: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
  postalCode: string;
  state: string;
  city: string;
  municipalityCode: string;
  neighborhood: string;
  address: string;
  addressNumber: string;
  addressComplement?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  dataProcessingAccepted: boolean;
}
export interface Campaign {
  id: string;
  slug: string;
  title: string;
  status: string;
  shortDescription?: string | null;
  description?: string | null;
  regulation?: string | null;
  mainPrizeName?: string | null;
  coverImageUrl?: string | null;
  coverImageRevision?: string | null;
  numberPrice: number;
  totalNumbers: number;
  soldNumbers: number;
  grossRevenue: number;
  drawDate?: string | null;
  draws?: {
    status: string;
    winningNumber?: string | null;
    confirmedAt?: string | null;
  }[];
  winners?: {
    id: string;
    prizeName: string;
    publicDisplayName?: string;
    winningNumber: string;
  }[];
  participantsCount?: number;
}
export interface Purchase {
  id: string;
  status: string;
  quantity: number;
  total: number;
  createdAt: string;
  confirmedAt?: string | null;
  campaign: Pick<Campaign, "id" | "slug" | "title"> & { organizerId?: string };
  buyer?: { id?: string; name?: string; phone?: string | null; email?: string };
  tickets?: Ticket[];
}
export interface Ticket {
  id: string;
  number: number;
  status: string;
}
export interface Dashboard {
  summary: {
    grossRevenue: number;
    revenueToday: number;
    revenueMonth: number;
    activeCampaigns: number;
    participants: number;
    soldTickets: number;
    averageTicket: number;
  };
  campaigns: Campaign[];
  revenueHistory?: { date: string; revenue: number }[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
export interface BuyerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  city?: string | null;
  state?: string | null;
  buyerAddress?: Omit<
    Registration,
    | "role"
    | "personType"
    | "name"
    | "cpf"
    | "email"
    | "phone"
    | "password"
    | "passwordConfirmation"
    | "termsAccepted"
    | "privacyAccepted"
    | "dataProcessingAccepted"
  > | null;
}
