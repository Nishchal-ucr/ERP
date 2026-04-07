import type {
  LoginDto,
  LoginResponseDto,
  Shed,
  Party,
  FeedItem,
  SubmitDailyReportDto,
  DailyReport,
  DailyReportResponseDto,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export { API_BASE_URL };

// Pure function to construct API URL
function buildUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Pure function to create fetch options
function createFetchOptions(
  method: string,
  body?: any,
  token?: string,
): RequestInit {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (token) {
    (options.headers as any)["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    options.body = JSON.stringify(body);
  }
  return options;
}

async function processResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw { status: response.status, message: data?.message };
  }
  return data;
}

// API Endpoint Functions

export async function getHello(): Promise<string> {
  const response = await fetch(buildUrl("/"));
  return processResponse(response);
}

export async function login(dto: LoginDto): Promise<LoginResponseDto> {
  const response = await fetch(
    buildUrl("/api/user/login"),
    createFetchOptions("POST", dto),
  );
  return processResponse(response);
}

export async function getAllSheds(): Promise<Shed[]> {
  const response = await fetch(buildUrl("/api/sheds"));
  return processResponse(response);
}

export async function getShedById(id: number): Promise<Shed> {
  const response = await fetch(buildUrl(`/api/sheds/${id}`));
  return processResponse(response);
}

export async function getAllParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties"));
  return processResponse(response);
}

export async function getBuyerParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties?role=buyer"));
  return processResponse(response);
}

export async function getSellerParties(): Promise<Party[]> {
  const response = await fetch(buildUrl("/api/parties?role=seller"));
  return processResponse(response);
}

export async function getPartyById(id: number): Promise<Party> {
  const response = await fetch(buildUrl(`/api/parties/${id}`));
  return processResponse(response);
}

export async function getAllFeedItems(): Promise<FeedItem[]> {
  const response = await fetch(buildUrl("/api/feed-items"));
  return processResponse(response);
}

export async function getFeedItemById(id: number): Promise<FeedItem> {
  const response = await fetch(buildUrl(`/api/feed-items/${id}`));
  return processResponse(response);
}

export async function submitDailyReport(
  dto: SubmitDailyReportDto,
): Promise<DailyReport> {
  const response = await fetch(
    buildUrl("/api/daily-reports/submit"),
    createFetchOptions("POST", dto),
  );
  return processResponse(response);
}

export async function updateDailyReport(
  dto: SubmitDailyReportDto,
): Promise<DailyReport> {
  const response = await fetch(
    buildUrl("/api/daily-reports/update"),
    createFetchOptions("PUT", dto),
  );
  return processResponse(response);
}

export async function getAllDailyReports(): Promise<DailyReport[]> {
  const response = await fetch(buildUrl("/api/daily-reports"));
  return processResponse(response);
}

export async function getDailyReportById(
  id: number,
): Promise<DailyReportResponseDto> {
  const response = await fetch(buildUrl(`/api/daily-reports/${id}`));
  return processResponse(response);
}

export async function getDailyReportByDate(
  date: string,
): Promise<DailyReportResponseDto> {
  const response = await fetch(buildUrl(`/api/daily-reports/by-date/${date}`));
  return processResponse(response);
}
