const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? 'Something went wrong');
  }

  return body as T;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

export const authApi = {
  register: (data: { fullName: string; email: string; password: string }) =>
    request<{ user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  me: () => request<Profile>('/users/me'),
  updateMe: (data: { fullName: string }) =>
    request<Profile>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  list: () => request<Profile[]>('/users'),
  create: (data: { fullName: string; email: string; password: string; role: Profile['role'] }) =>
    request<Profile>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, role: Profile['role']) =>
    request<Profile>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
};

export interface AdminStats {
  totalUsers: number;
  usersByRole: { STUDENT: number; FACULTY: number; ADMIN: number };
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  recentUsers: Profile[];
}

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),
};

export type LessonType = 'VIDEO' | 'PDF' | 'LIVE' | 'FLASHCARD';

export interface Lesson {
  id: string;
  title: string;
  order: number;
  type: LessonType;
  contentUrl: string | null;
  liveAt: string | null;
  flashcardsEnabled: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  bannerUrl: string | null;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  published: boolean;
  facultyId: string;
  createdAt: string;
  updatedAt: string;
  segmentId: string | null;
  subsegmentId: string | null;
  _count?: { enrollments: number };
}

export interface CourseTree extends Course {
  chapters: Chapter[];
}

export interface Subsegment {
  id: string;
  name: string;
  order: number;
  segmentId: string;
  _count?: { courses: number };
}

export interface Segment {
  id: string;
  name: string;
  order: number;
  bannerUrl: string | null;
  subsegments: Subsegment[];
  _count?: { courses: number };
}

export const segmentsApi = {
  list: () => request<Segment[]>('/segments'),
  get: (id: string) => request<Segment>(`/segments/${id}`),
  create: (data: { name: string; order?: number; bannerUrl?: string }) =>
    request<Segment>('/segments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; order?: number; bannerUrl?: string }) =>
    request<Segment>(`/segments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/segments/${id}`, { method: 'DELETE' }),
  createSubsegment: (segmentId: string, data: { name: string; order?: number }) =>
    request<Subsegment>(`/segments/${segmentId}/subsegments`, { method: 'POST', body: JSON.stringify(data) }),
  updateSubsegment: (id: string, data: { name?: string; order?: number }) =>
    request<Subsegment>(`/subsegments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeSubsegment: (id: string) => request<{ success: boolean }>(`/subsegments/${id}`, { method: 'DELETE' }),
};

export const coursesApi = {
  list: (params?: { segmentId?: string; subsegmentId?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>,
    ).toString();
    return request<Course[]>(`/courses${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<CourseTree>(`/courses/${id}`),
  create: (data: { title: string; description?: string; thumbnailUrl?: string }) =>
    request<Course>('/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<Pick<Course, 'title' | 'description' | 'published' | 'thumbnailUrl' | 'segmentId' | 'subsegmentId'>>,
  ) => request<Course>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/courses/${id}`, { method: 'DELETE' }),

  createChapter: (courseId: string, data: { title: string; order?: number; bannerUrl?: string }) =>
    request<Chapter>(`/courses/${courseId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: { title?: string; order?: number; bannerUrl?: string }) =>
    request<Chapter>(`/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeChapter: (id: string) => request<{ success: boolean }>(`/chapters/${id}`, { method: 'DELETE' }),

  createLesson: (
    chapterId: string,
    data: { title: string; type: LessonType; order?: number; contentUrl?: string; liveAt?: string; flashcardsEnabled?: boolean },
  ) => request<Lesson>(`/chapters/${chapterId}/lessons`, { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: (id: string, data: Partial<Pick<Lesson, 'title' | 'type' | 'order' | 'contentUrl' | 'liveAt' | 'flashcardsEnabled'>>) =>
    request<Lesson>(`/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeLesson: (id: string) => request<{ success: boolean }>(`/lessons/${id}`, { method: 'DELETE' }),
};

export type FlashcardStatus = 'NEW' | 'LEARNING' | 'KNOWN';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  order: number;
  lessonId: string;
  status?: FlashcardStatus;
}

export const flashcardsApi = {
  list: (lessonId: string) => request<Flashcard[]>(`/lessons/${lessonId}/flashcards`),
  create: (lessonId: string, data: { front: string; back: string; order?: number }) =>
    request<Flashcard>(`/lessons/${lessonId}/flashcards`, { method: 'POST', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/flashcards/${id}`, { method: 'DELETE' }),
  generate: (lessonId: string, count?: number) =>
    request<Flashcard[]>(`/lessons/${lessonId}/flashcards/generate`, { method: 'POST', body: JSON.stringify({ count }) }),
};

export const uploadsApi = {
  async presign(fileName: string, contentType: string) {
    return request<{ uploadUrl: string; key: string }>('/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType }),
    });
  },

  async uploadFile(file: File): Promise<string> {
    const { uploadUrl, key } = await this.presign(file.name, file.type);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'Upload to storage failed');
    }
    return key;
  },

  async uploadQuestionImage(file: File): Promise<string> {
    const { uploadUrl, publicUrl } = await request<{ uploadUrl: string; publicUrl: string }>('/uploads/question-image-presign', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, contentType: file.type }),
    });
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'Image upload failed');
    }
    return publicUrl;
  },
};

export type QuestionType = 'MCQ' | 'FILL_BLANK' | 'ESSAY' | 'TRUE_FALSE';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  order: number;
  options: string[];
  correctOption: string | null;
  questionBankId: string;
}

export interface QuestionBank {
  id: string;
  title: string;
  description: string;
  bannerUrl: string | null;
  published: boolean;
  facultyId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { questions: number };
}

export interface QuestionBankTree extends QuestionBank {
  questions: Question[];
}

export const questionBanksApi = {
  list: () => request<QuestionBank[]>('/question-banks'),
  get: (id: string) => request<QuestionBankTree>(`/question-banks/${id}`),
  create: (data: { title: string; description?: string; bannerUrl?: string }) =>
    request<QuestionBank>('/question-banks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<QuestionBank, 'title' | 'description' | 'bannerUrl' | 'published'>>) =>
    request<QuestionBank>(`/question-banks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/question-banks/${id}`, { method: 'DELETE' }),

  createQuestion: (
    bankId: string,
    data: { type: QuestionType; prompt: string; order?: number; options?: string[]; correctOption?: string },
  ) => request<Question>(`/question-banks/${bankId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuestion: (id: string, data: Partial<Pick<Question, 'type' | 'prompt' | 'order' | 'options' | 'correctOption'>>) =>
    request<Question>(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeQuestion: (id: string) => request<{ success: boolean }>(`/questions/${id}`, { method: 'DELETE' }),
};

export type TestPublishMode = 'MANUAL' | 'TIMED';

export interface TestQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  order: number;
  options: string[];
  correctOption: string | null;
  testId: string;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  bannerUrl: string | null;
  published: boolean;
  publishMode: TestPublishMode;
  availableFrom: string | null;
  availableUntil: string | null;
  durationMinutes: number | null;
  facultyId: string;
  chapterId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { testQuestions: number };
}

export interface TestTree extends Test {
  testQuestions: TestQuestion[];
}

export const testsApi = {
  list: () => request<Test[]>('/tests'),
  get: (id: string) => request<TestTree>(`/tests/${id}`),
  create: (data: { title: string; description?: string; bannerUrl?: string; chapterId?: string }) =>
    request<Test>('/tests', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<
      Pick<
        Test,
        | 'title'
        | 'description'
        | 'bannerUrl'
        | 'published'
        | 'publishMode'
        | 'availableFrom'
        | 'availableUntil'
        | 'durationMinutes'
        | 'chapterId'
      >
    >,
  ) => request<Test>(`/tests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/tests/${id}`, { method: 'DELETE' }),

  createQuestion: (
    testId: string,
    data: { type: QuestionType; prompt: string; order?: number; options?: string[]; correctOption?: string },
  ) => request<TestQuestion>(`/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuestion: (id: string, data: Partial<Pick<TestQuestion, 'type' | 'prompt' | 'order' | 'options' | 'correctOption'>>) =>
    request<TestQuestion>(`/test-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeQuestion: (id: string) => request<{ success: boolean }>(`/test-questions/${id}`, { method: 'DELETE' }),

  importQuestions: (testId: string, data: { questionBankId: string; questionIds?: string[] }) =>
    request<TestQuestion[]>(`/tests/${testId}/import-questions`, { method: 'POST', body: JSON.stringify(data) }),
};
