export function isRegistrationDeadlineOpen(
  deadline?: Date | string | null,
  now: Date = new Date(),
) {
  if (!deadline) return true;
  return new Date(deadline) >= now;
}
