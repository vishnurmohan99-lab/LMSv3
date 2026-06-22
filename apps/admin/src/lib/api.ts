const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let refreshPromise: Promise<boolean> | null = null;

// The access_token cookie expires after 15 minutes; the refresh_token lives for 7 days.
// On a 401 we silently exchange it for a fresh access token and retry once, instead of
// forcing the user back to the login page just because they were idle for >15 minutes.
function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401 && !_retried && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

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
  isMentor?: boolean;
  mentorSpecialty?: string | null;
  segmentId?: string | null;
  subsegmentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  me: () => request<Profile>('/users/me'),
  updateMe: (data: { fullName?: string; segmentId?: string | null; subsegmentId?: string | null }) =>
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
  aiNotesEnabled: boolean;
  askMeEnabled: boolean;
  transcript: string | null;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  bannerUrl: string | null;
  lessons: Lesson[];
}

export type CourseType = 'FREE' | 'PAID' | 'PRIVATE';

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  published: boolean;
  type: CourseType;
  facultyId: string;
  createdAt: string;
  updatedAt: string;
  segmentId: string | null;
  subsegmentId: string | null;
  _count?: { enrollments: number };
}

export interface CoursePrivateAccess {
  id: string;
  courseId: string;
  studentId: string;
  createdAt: string;
  student: { id: string; fullName: string; email: string };
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
  create: (data: { title: string; description?: string; thumbnailUrl?: string; segmentId?: string; subsegmentId?: string; type?: CourseType }) =>
    request<Course>('/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<Pick<Course, 'title' | 'description' | 'published' | 'thumbnailUrl' | 'segmentId' | 'subsegmentId' | 'type'>>,
  ) => request<Course>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/courses/${id}`, { method: 'DELETE' }),

  listPrivateAccess: (courseId: string) => request<CoursePrivateAccess[]>(`/courses/${courseId}/private-access`),
  grantPrivateAccess: (courseId: string, studentId: string) =>
    request<CoursePrivateAccess>(`/courses/${courseId}/private-access/${studentId}`, { method: 'POST' }),
  revokePrivateAccess: (courseId: string, studentId: string) =>
    request<{ success: boolean }>(`/courses/${courseId}/private-access/${studentId}`, { method: 'DELETE' }),

  createChapter: (courseId: string, data: { title: string; order?: number; bannerUrl?: string }) =>
    request<Chapter>(`/courses/${courseId}/chapters`, { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: string, data: { title?: string; order?: number; bannerUrl?: string }) =>
    request<Chapter>(`/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeChapter: (id: string) => request<{ success: boolean }>(`/chapters/${id}`, { method: 'DELETE' }),

  createLesson: (
    chapterId: string,
    data: {
      title: string;
      type: LessonType;
      order?: number;
      contentUrl?: string;
      liveAt?: string;
      flashcardsEnabled?: boolean;
      aiNotesEnabled?: boolean;
      askMeEnabled?: boolean;
      transcript?: string;
    },
  ) => request<Lesson>(`/chapters/${chapterId}/lessons`, { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: (
    id: string,
    data: Partial<
      Pick<
        Lesson,
        'title' | 'type' | 'order' | 'contentUrl' | 'liveAt' | 'flashcardsEnabled' | 'aiNotesEnabled' | 'askMeEnabled' | 'transcript'
      >
    >,
  ) => request<Lesson>(`/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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

export interface LessonNote {
  id: string;
  summary: string;
  keyPoints: string[];
  lessonId: string;
  updatedAt: string;
}

export const notesApi = {
  get: (lessonId: string) => request<LessonNote | null>(`/lessons/${lessonId}/notes`),
  generate: (lessonId: string) => request<LessonNote>(`/lessons/${lessonId}/notes/generate`, { method: 'POST' }),
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
  courseId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { testQuestions: number };
}

export interface TestTree extends Test {
  testQuestions: TestQuestion[];
}

export const testsApi = {
  list: (params?: { courseId?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>,
    ).toString();
    return request<Test[]>(`/tests${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<TestTree>(`/tests/${id}`),
  create: (data: { title: string; description?: string; bannerUrl?: string; chapterId?: string; courseId?: string }) =>
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
        | 'courseId'
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

export type TestAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED';

export interface TestAttemptQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  order: number;
  testId: string;
}

export interface TestAttempt {
  id: string;
  status: TestAttemptStatus;
  score: number | null;
  maxScore: number | null;
  startedAt: string;
  submittedAt: string | null;
  testId: string;
  studentId: string;
  testQuestions?: TestAttemptQuestion[];
}

export interface TestAnswerResult {
  id: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  attemptId: string;
  testQuestionId: string;
  testQuestion: TestQuestion;
}

export interface TestAttemptResult extends TestAttempt {
  answers: TestAnswerResult[];
}

export const testAttemptsApi = {
  start: (testId: string) => request<TestAttempt>(`/tests/${testId}/attempts`, { method: 'POST' }),
  mine: (testId: string) => request<TestAttempt[]>(`/tests/${testId}/attempts/mine`),
  saveAnswer: (attemptId: string, testQuestionId: string, selectedOption?: string) =>
    request<{ id: string }>(`/attempts/${attemptId}/answers`, { method: 'PATCH', body: JSON.stringify({ testQuestionId, selectedOption }) }),
  submit: (attemptId: string) => request<TestAttemptResult>(`/attempts/${attemptId}/submit`, { method: 'POST' }),
};

export const workoutApi = {
  getQuestions: (courseId: string, params: { chapterId?: string; types: QuestionType[]; count: number }) => {
    const qs = new URLSearchParams({ types: params.types.join(','), count: String(params.count) });
    if (params.chapterId) qs.set('chapterId', params.chapterId);
    return request<Question[]>(`/workout/courses/${courseId}/questions?${qs.toString()}`);
  },
};

export interface BatchStatusType {
  id: string;
  name: string;
  color: string | null;
  order: number;
  isDefault: boolean;
  isCompletionTarget: boolean;
  createdAt: string;
  updatedAt: string;
}

export const batchStatusTypesApi = {
  list: () => request<BatchStatusType[]>('/batch-status-types'),
  create: (data: { name: string; color?: string; order?: number; isDefault?: boolean; isCompletionTarget?: boolean }) =>
    request<BatchStatusType>('/batch-status-types', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<BatchStatusType, 'name' | 'color' | 'order' | 'isDefault' | 'isCompletionTarget'>>) =>
    request<BatchStatusType>(`/batch-status-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/batch-status-types/${id}`, { method: 'DELETE' }),
};

export interface Batch {
  id: string;
  name: string;
  statusId: string;
  status: { id: string; name: string; color: string | null };
  startDate: string;
  endDate: string | null;
  segmentId: string | null;
  subsegmentId: string | null;
  segment?: { id: string; name: string } | null;
  subsegment?: { id: string; name: string } | null;
  facultyId: string | null;
  faculty?: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { enrollments: number; sessions: number };
}

export interface BatchStats {
  totalBatches: number;
  totalLearners: number;
  byStatus: { statusId: string; name: string; count: number }[];
  bySegment: { id: string; label: string; byStatus: { statusId: string; name: string; count: number }[] }[];
}

export interface BulkOperation {
  id: string;
  type: 'BATCH_ENROLL';
  payload: { batchId: string; studentIds: string[] };
  createdAt: string;
  undoneAt: string | null;
}

export interface BatchEnrollment {
  id: string;
  studentId: string;
  batchId: string;
  joinedAt: string;
  accessExpiresAt: string | null;
  student: { id: string; fullName: string; email: string };
}

export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface Session {
  id: string;
  title: string;
  scheduledAt: string;
  durationMin: number;
  status: SessionStatus;
  actualStartAt: string | null;
  actualEndAt: string | null;
  batchId: string;
  lessonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchTree extends Batch {
  enrollments: BatchEnrollment[];
  sessions: Session[];
}

export const batchesApi = {
  list: (params?: { segmentId?: string; subsegmentId?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>).toString();
    return request<Batch[]>(`/batches${qs ? `?${qs}` : ''}`);
  },
  listAll: () => request<Batch[]>('/batches'),
  listMine: () => request<Batch[]>('/batches/mine'),
  get: (id: string) => request<BatchTree>(`/batches/${id}`),
  stats: () => request<BatchStats>('/batches/stats'),
  create: (data: { name: string; statusId?: string; startDate: string; endDate?: string; facultyId?: string; segmentId?: string; subsegmentId?: string }) =>
    request<Batch>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Batch, 'name' | 'statusId' | 'startDate' | 'endDate' | 'facultyId'>>) =>
    request<Batch>(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/batches/${id}`, { method: 'DELETE' }),
  extend: (id: string, newEndDate: string) =>
    request<Batch>(`/batches/${id}/extend`, { method: 'POST', body: JSON.stringify({ newEndDate }) }),

  enroll: (batchId: string, studentId: string) =>
    request<BatchEnrollment>(`/batches/${batchId}/enroll`, { method: 'POST', body: JSON.stringify({ studentId }) }),
  bulkEnroll: (batchId: string, studentIds: string[]) =>
    request<{ enrolled: number; skipped: number; bulkOperationId?: string }>(`/batches/${batchId}/enroll/bulk`, {
      method: 'POST',
      body: JSON.stringify({ studentIds }),
    }),
  enrollCsv: async (batchId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/batches/${batchId}/enroll/csv`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body?.message ?? 'Failed to import CSV');
    return body as { enrolled: number; skipped: number; bulkOperationId?: string };
  },
  unenroll: (batchId: string, studentId: string) =>
    request<{ success: boolean }>(`/batches/${batchId}/enroll/${studentId}`, { method: 'DELETE' }),
};

export const bulkOperationsApi = {
  listForBatch: (batchId: string) => request<BulkOperation[]>(`/batches/${batchId}/bulk-operations`),
  undo: (id: string) => request<BulkOperation>(`/bulk-operations/${id}/undo`, { method: 'POST' }),
};

export const sessionsApi = {
  listForBatch: (batchId: string) => request<Session[]>(`/batches/${batchId}/sessions`),
  list: (params?: { batchId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>,
    ).toString();
    return request<Session[]>(`/sessions${qs ? `?${qs}` : ''}`);
  },
  create: (batchId: string, data: { title: string; scheduledAt: string; durationMin: number; status?: SessionStatus; lessonId?: string }) =>
    request<Session>(`/batches/${batchId}/sessions`, { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<Pick<Session, 'title' | 'scheduledAt' | 'durationMin' | 'status' | 'lessonId' | 'actualStartAt' | 'actualEndAt'>>,
  ) => request<Session>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),
};

export type ConversationType = 'DIRECT' | 'COURSE_BROADCAST' | 'BATCH_BROADCAST' | 'GROUP';

export interface ConversationParticipant {
  id: string;
  userId: string;
  user: { id: string; fullName: string; email: string; role: 'STUDENT' | 'FACULTY' | 'ADMIN' };
}

export interface Message {
  id: string;
  body: string;
  createdAt: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; fullName: string; role: 'STUDENT' | 'FACULTY' | 'ADMIN' };
}

export interface Conversation {
  id: string;
  type: ConversationType;
  createdAt: string;
  courseId: string | null;
  batchId: string | null;
  createdById: string;
  participants: ConversationParticipant[];
  course: { id: string; title: string } | null;
  batch: { id: string; name: string } | null;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface ScheduledMessage {
  id: string;
  body: string;
  sendAt: string;
  sentAt: string | null;
  createdAt: string;
  conversationId: string;
  senderId: string;
}

export const messengerApi = {
  listContacts: () => request<{ id: string; fullName: string; email: string; role: 'STUDENT' | 'FACULTY' | 'ADMIN' }[]>('/messenger/contacts'),
  listConversations: () => request<Conversation[]>('/conversations'),
  createConversation: (data: { type: ConversationType; userId?: string; courseId?: string; batchId?: string; participantIds?: string[] }) =>
    request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  listMessages: (conversationId: string) => request<Message[]>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    request<Message>(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  markRead: (conversationId: string) =>
    request<{ success: boolean }>(`/conversations/${conversationId}/read`, { method: 'POST' }),
  getUnreadCount: () => request<{ count: number }>('/messages/unread-count'),
  scheduleMessage: (data: { conversationId: string; body: string; sendAt: string }) =>
    request<ScheduledMessage>('/scheduled-messages', { method: 'POST', body: JSON.stringify(data) }),
  listScheduled: () => request<ScheduledMessage[]>('/scheduled-messages'),
  cancelScheduled: (id: string) => request<{ success: boolean }>(`/scheduled-messages/${id}`, { method: 'DELETE' }),
};

export interface Mentor {
  id: string;
  fullName: string;
  email: string;
  mentorSpecialty: string | null;
}

export interface MentorAvailability {
  id: string;
  dayOfWeek: number;
  time: string;
  createdAt: string;
  mentorId: string;
}

export interface MentorSlot {
  availabilityId: string;
  date: string;
  time: string;
  dayOfWeek: number;
  booked: boolean;
}

export interface MentorBooking {
  id: string;
  date: string;
  createdAt: string;
  cancelledAt: string | null;
  availabilityId: string;
  mentorId: string;
  studentId: string;
  mentor?: Mentor;
  student?: { id: string; fullName: string; email: string };
  availability?: MentorAvailability;
}

export const mentorApi = {
  listMentors: () => request<Mentor[]>('/mentors'),
  setMentorFlag: (userId: string, data: { isMentor: boolean; specialty?: string }) =>
    request<Mentor>(`/users/${userId}/mentor`, { method: 'POST', body: JSON.stringify(data) }),
  getSlots: (mentorId: string, days = 14) => request<MentorSlot[]>(`/mentors/${mentorId}/slots?days=${days}`),
  listOwnAvailability: () => request<MentorAvailability[]>('/mentor/availability'),
  addAvailability: (data: { dayOfWeek: number; time: string }) =>
    request<MentorAvailability>('/mentor/availability', { method: 'POST', body: JSON.stringify(data) }),
  removeAvailability: (id: string) => request<{ success: boolean }>(`/mentor/availability/${id}`, { method: 'DELETE' }),
  listBookingsAsMentor: () => request<MentorBooking[]>('/mentor/bookings/mine'),
  listBookingsAsStudent: () => request<MentorBooking[]>('/mentor/bookings/me'),
  createBooking: (mentorId: string, data: { availabilityId: string; date: string }) =>
    request<MentorBooking>(`/mentors/${mentorId}/bookings`, { method: 'POST', body: JSON.stringify(data) }),
  cancelBooking: (id: string) => request<{ success: boolean }>(`/mentor/bookings/${id}`, { method: 'DELETE' }),
};

export type FeedbackTargetType = 'COURSE' | 'FACULTY' | 'MENTOR' | 'SYSTEM';
export type FeedbackAssignType = 'BATCH' | 'SELECTED';
export type FeedbackQuestionType = 'RATING' | 'TEXT';

export interface FeedbackQuestion {
  type: FeedbackQuestionType;
  label: string;
}

export interface FeedbackForm {
  id: string;
  title: string;
  targetType: FeedbackTargetType;
  targetSystemArea: string | null;
  questions: FeedbackQuestion[];
  assignType: FeedbackAssignType;
  createdAt: string;
  targetCourseId: string | null;
  targetFacultyId: string | null;
  batchId: string | null;
  createdById: string;
  targetCourse: { id: string; title: string } | null;
  targetFaculty: { id: string; fullName: string } | null;
  batch: { id: string; name: string } | null;
  _count: { responses: number };
  avgRating?: number | null;
  submitted?: boolean;
}

export interface FeedbackResponse {
  id: string;
  answers: (string | number)[];
  submittedAt: string;
  formId: string;
  studentId: string;
  student?: { id: string; fullName: string; email: string };
  rating?: number | null;
}

export interface FeedbackFormWithResponses extends FeedbackForm {
  responses: FeedbackResponse[];
}

export interface FeedbackFormWithMyResponse extends FeedbackForm {
  myResponse: FeedbackResponse | null;
}

export const feedbackApi = {
  list: () => request<FeedbackForm[]>('/feedback-forms'),
  create: (data: {
    title: string;
    targetType: FeedbackTargetType;
    targetCourseId?: string;
    targetFacultyId?: string;
    targetSystemArea?: string;
    questions: FeedbackQuestion[];
    assignType: FeedbackAssignType;
    batchId?: string;
    studentIds?: string[];
  }) => request<FeedbackForm>('/feedback-forms', { method: 'POST', body: JSON.stringify(data) }),
  getForAdmin: (id: string) => request<FeedbackFormWithResponses>(`/feedback-forms/${id}/admin`),
  listMine: () => request<FeedbackForm[]>('/feedback-forms/me'),
  getForFill: (id: string) => request<FeedbackFormWithMyResponse>(`/feedback-forms/${id}`),
  submit: (id: string, answers: (string | number)[]) =>
    request<FeedbackResponse>(`/feedback-forms/${id}/responses`, { method: 'POST', body: JSON.stringify({ answers }) }),
};

export interface ForumCategory {
  id: string;
  name: string;
  count: number;
}

export interface ForumAuthor {
  id: string;
  fullName: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

export interface ForumThread {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  courseId: string | null;
  authorId: string;
  author: ForumAuthor;
  _count: { posts: number; likes: number };
}

export interface ForumPost {
  id: string;
  body: string;
  createdAt: string;
  threadId: string;
  authorId: string;
  author: ForumAuthor;
}

export interface ForumThreadDetail extends ForumThread {
  posts: ForumPost[];
  likedByMe: boolean;
}

export const forumApi = {
  listCategories: () => request<ForumCategory[]>('/forum/categories'),
  listThreads: (params?: { categoryId?: string; search?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v)) as Record<string, string>).toString();
    return request<ForumThread[]>(`/forum/threads${qs ? `?${qs}` : ""}`);
  },
  getThread: (id: string) => request<ForumThreadDetail>(`/forum/threads/${id}`),
  createThread: (data: { title: string; body: string; courseId?: string }) =>
    request<ForumThread>('/forum/threads', { method: 'POST', body: JSON.stringify(data) }),
  addPost: (threadId: string, body: string) =>
    request<ForumPost>(`/forum/threads/${threadId}/posts`, { method: 'POST', body: JSON.stringify({ body }) }),
  toggleLike: (threadId: string) => request<{ liked: boolean }>(`/forum/threads/${threadId}/like`, { method: 'POST' }),
  updateThread: (threadId: string, data: { pinned?: boolean; locked?: boolean }) =>
    request<ForumThread>(`/forum/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export interface AdminReport {
  enrollmentTrend: { period: string; count: number }[];
  scoreDistribution: { bucket: string; count: number }[];
  batchCompletion: { completed: number; total: number; rate: number };
  totals: { totalCourses: number; totalBatches: number; totalMockTestAttempts: number; totalEnrollments: number };
}

export interface FacultyReportCourse {
  courseId: string;
  title: string;
  enrollmentCount: number;
  batches: { id: string; name: string; status: string; enrolledCount: number }[];
  mockTestCount: number;
  students: { id: string; fullName: string; email: string; enrolledAt: string; bestScorePct: number | null; attemptCount: number }[];
}

export const reportsApi = {
  getAdminReport: () => request<AdminReport>('/reports/admin'),
  getFacultyReport: () => request<FacultyReportCourse[]>('/reports/faculty'),
};

export interface Subscription {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  _count: { courses: number; tests: number; enrollments: number };
  subscribed?: boolean;
}

export interface SubscriptionDetail extends Subscription {
  courses: { course: { id: string; title: string; type: CourseType } }[];
  tests: { test: { id: string; title: string } }[];
  enrollments: { studentId: string; student: { id: string; fullName: string; email: string } }[];
}

export const subscriptionsApi = {
  listAll: () => request<Subscription[]>('/subscriptions'),
  getDetail: (id: string) => request<SubscriptionDetail>(`/subscriptions/${id}`),
  create: (data: { title: string; description?: string }) =>
    request<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; description?: string }) =>
    request<Subscription>(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request<{ success: boolean }>(`/subscriptions/${id}`, { method: 'DELETE' }),
  addCourse: (id: string, courseId: string) => request(`/subscriptions/${id}/courses/${courseId}`, { method: 'POST' }),
  removeCourse: (id: string, courseId: string) => request<{ success: boolean }>(`/subscriptions/${id}/courses/${courseId}`, { method: 'DELETE' }),
  addTest: (id: string, testId: string) => request(`/subscriptions/${id}/tests/${testId}`, { method: 'POST' }),
  removeTest: (id: string, testId: string) => request<{ success: boolean }>(`/subscriptions/${id}/tests/${testId}`, { method: 'DELETE' }),
  enrollStudent: (id: string, studentId: string) => request(`/subscriptions/${id}/enroll/${studentId}`, { method: 'POST' }),
  unenrollStudent: (id: string, studentId: string) => request<{ success: boolean }>(`/subscriptions/${id}/enroll/${studentId}`, { method: 'DELETE' }),
};
