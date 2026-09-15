export function isExampleLimoFinalFarewell(content: string) {
  const normalized = content.trim().toLocaleLowerCase()
  return /(?:^|[,;.!?]\s*)(?:goodbye|hasta luego)[¡!?.]*$/.test(normalized)
}
