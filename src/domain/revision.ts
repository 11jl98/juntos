export function assertRevision(opened: number, current: number) {
  if (opened !== current)
    throw new Error(
      "Os dados foram atualizados desde que este formulário foi aberto. Feche e abra novamente para revisar os valores atuais.",
    );
}
