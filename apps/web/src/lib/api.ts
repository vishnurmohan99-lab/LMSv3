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
};

export type LessonType = 'VIDEO' | 'PDF' | 'LIVE' | 'FLASHCARD';

export interface Lesson {
  id: string;
  title: string;
  order: number;
  type: LessonType;
  contentUrl: string | null;
  liveAt: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
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
  _count?: { enrollments: number };
}

export interface CourseTree extends Course {
  chapters: Chapter[];
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
  course: Course;
}

export const coursesApi = {
  list: () => request<Course[]>('/courses'),
  get: (id: string) => request<CourseTree>(`/courses/${id}`),
  create: (data: { title: string; description?: string }) =>
    request<Course>('/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Course, 'title' | 'description' | 'published' | 'thumbnailUrl'>>) =>
    request<Course>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/courses/${id}`, { method: 'DELETE' }),
  enroll: (id: string) => request<{ id: string }>(`/courses/${id}/enroll`, { method: 'POST' }),

  createChapter: (courseId: string, data: { title: string; order?: number }) =>
    request<Chapter>(`/courses/${courseId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: { title?: string; order?: number }) =>
    request<Chapter>(`/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeChapter: (id: string) => request<{ success: boolean }>(`/chapters/${id}`, { method: 'DELETE' }),

  createLesson: (
    chapterId: string,
    data: { title: string; type: LessonType; order?: number; contentUrl?: string; liveAt?: string },
  ) => request<Lesson>(`/chapters/${chapterId}/lessons`, { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: (id: string, data: Partial<Pick<Lesson, 'title' | 'type' | 'order' | 'contentUrl' | 'liveAt'>>) =>
    request<Lesson>(`/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeLesson: (id: string) => request<{ success: boolean }>(`/lessons/${id}`, { method: 'DELETE' }),
};

export const enrollmentsApi = {
  mine: () => request<Enrollment[]>('/enrollments/me'),
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
  setProgress: (id: string, status: FlashcardStatus) =>
    request<{ id: string }>(`/flashcards/${id}/progress`, { method: 'POST', body: JSON.stringify({ status }) }),
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
};
