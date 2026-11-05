export const errorMessages = {
  required: [
    "Please fill in this field.",
    "Заполните это поле.",
    "Bu maydonni to‘ldiring.",
  ],
  format: [
    "Enter a valid value.",
    "Введите корректное значение.",
    "To‘g‘ri qiymat kiriting.",
  ],
  minLength: [
    "Enter at least {limit} characters.",
    "Введите не менее {limit} символов.",
    "Kamida {limit} ta belgi kiriting.",
  ],
  maxLength: [
    "Use no more than {limit} characters.",
    "Не более {limit} символов.",
    "Ko‘pi bilan {limit} ta belgi kiriting.",
  ],
  min: [
    "Enter a value of at least {limit}.",
    "Минимальное значение: {limit}.",
    "Eng kichik qiymat: {limit}.",
  ],
  max: [
    "Enter a value no greater than {limit}.",
    "Максимальное значение: {limit}.",
    "Eng katta qiymat: {limit}.",
  ],
  integer: [
    "Enter a whole number.",
    "Введите целое число.",
    "Butun son kiriting.",
  ],
  volume: [
    "Remaining volume cannot exceed bottle size.",
    "Остаток не может превышать объём флакона.",
    "Qolgan hajm flakon hajmidan oshmasligi kerak.",
  ],
  phone: [
    "Use +998 followed by 9 digits.",
    "Введите +998 и 9 цифр номера.",
    "+998 dan keyin 9 ta raqam kiriting.",
  ],
  username: [
    "Use a Telegram username of 5–32 letters, numbers or underscores, starting with a letter.",
    "Введите имя Telegram: 5–32 буквы, цифры или знака _, начиная с буквы.",
    "Telegram nomi 5–32 ta harf, raqam yoki _ belgisidan iborat bo‘lsin va harf bilan boshlansin.",
  ],
  photos: [
    "Upload 1–4 photos of your own bottle.",
    "Загрузите 1–4 фото своего флакона.",
    "O‘z flakoningizning 1–4 ta rasmini yuklang.",
  ],
  photoSize: [
    "Each photo must be no larger than 5 MB.",
    "Размер каждого фото — не более 5 МБ.",
    "Har bir rasm 5 MB dan oshmasin.",
  ],
  photoType: [
    "Choose a JPG, PNG or WebP image.",
    "Выберите изображение JPG, PNG или WebP.",
    "JPG, PNG yoki WebP rasmini tanlang.",
  ],
  ownPhotos: [
    "Use photos uploaded by your account.",
    "Используйте фото, загруженные с вашего аккаунта.",
    "O‘z akkauntingiz orqali yuklangan rasmlardan foydalaning.",
  ],
  consent: [
    "Please confirm that the photos are yours and the details are accurate.",
    "Подтвердите, что фото ваши и сведения верны.",
    "Rasmlar sizga tegishli va ma’lumotlar to‘g‘riligini tasdiqlang.",
  ],
  signIn: [
    "Sign in to continue.",
    "Войдите, чтобы продолжить.",
    "Davom etish uchun kiring.",
  ],
  forbidden: [
    "You do not have permission for this action.",
    "У вас нет разрешения на это действие.",
    "Bu amal uchun ruxsatingiz yo‘q.",
  ],
  origin: [
    "This request could not be verified. Reload the page and try again.",
    "Не удалось проверить запрос. Обновите страницу и повторите.",
    "So‘rovni tekshirib bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring.",
  ],
  unavailable: [
    "The service is temporarily unavailable. Please try again.",
    "Сервис временно недоступен. Попробуйте ещё раз.",
    "Xizmat vaqtincha ishlamayapti. Qayta urinib ko‘ring.",
  ],
  notFound: [
    "This record was not found.",
    "Запись не найдена.",
    "Ma’lumot topilmadi.",
  ],
  profileRequired: [
    "Complete your profile before publishing a fragrance.",
    "Заполните профиль перед публикацией объявления.",
    "Atir e’lonini joylashtirishdan oldin profilingizni to‘ldiring.",
  ],
  suspended: [
    "Your account is suspended. Contact the marketplace administrator.",
    "Ваш аккаунт приостановлен. Свяжитесь с администратором.",
    "Akkauntingiz to‘xtatilgan. Administrator bilan bog‘laning.",
  ],
  adminOnly: [
    "This area is available only to the administrator.",
    "Этот раздел доступен только администратору.",
    "Bu bo‘lim faqat administrator uchun.",
  ],
  protectAdmin: [
    "Administrator accounts cannot be suspended here.",
    "Аккаунт администратора нельзя приостановить здесь.",
    "Administrator akkauntini bu yerda to‘xtatib bo‘lmaydi.",
  ],
  invalid: [
    "Check the information and try again.",
    "Проверьте данные и повторите.",
    "Ma’lumotlarni tekshirib, qayta urinib ko‘ring.",
  ],
  reason: [
    "Enter a reason of 5–300 characters.",
    "Укажите причину: от 5 до 300 символов.",
    "Sababni 5–300 ta belgi bilan yozing.",
  ],
} as const;
export type ErrorCode = keyof typeof errorMessages;
export type ErrorInfo = { code: ErrorCode; field?: string; limit?: number };
export function languageIndex(request: Request) {
  const value = request.headers.get("x-fragweb-language") || "en";
  return value === "ru" ? 1 : value === "uz" ? 2 : 0;
}
export function errorText(info: ErrorInfo, lang: number) {
  return errorMessages[info.code][lang === 1 ? 1 : lang === 2 ? 2 : 0].replace(
    "{limit}",
    String(info.limit ?? ""),
  );
}
export function failure(
  request: Request,
  code: ErrorCode,
  status: number,
  field?: string,
  limit?: number,
) {
  const info = { code, field, limit };
  return Response.json(
    { ...info, error: errorText(info, languageIndex(request)) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export class ApiError extends Error {
  info: ErrorInfo;
  constructor(info: ErrorInfo) {
    super(info.code);
    this.info = info;
  }
}
export function errorInfo(error: unknown): ErrorInfo {
  return error instanceof ApiError ? error.info : { code: "unavailable" };
}
export async function apiJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & Partial<ErrorInfo>;
  if (!response.ok)
    throw new ApiError({
      code:
        value.code && value.code in errorMessages ? value.code : "unavailable",
      field: value.field,
      limit: value.limit,
    });
  return value;
}
