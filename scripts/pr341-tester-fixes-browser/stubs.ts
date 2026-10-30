export function useNavigate() {
  return () => {};
}

export function useMutation() {
  return async () => true;
}

export function useAction() {
  return async () => [];
}

export function useQuery() {
  return { stale: false };
}

export function useEsvCompositePassage() {
  return {
    text: PSALM_23,
    segments: [],
    loading: false,
    error: null,
    retry: () => {},
  };
}

const PSALM_23_ONCE = [
  "The Lord is my shepherd; I shall not want.",
  "He makes me lie down in green pastures. He leads me beside still waters.",
  "He restores my soul. He leads me in paths of righteousness for his name's sake.",
  "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
  "You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows.",
  "Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the Lord forever.",
].join(" ");

const PSALM_23 = [PSALM_23_ONCE, PSALM_23_ONCE, PSALM_23_ONCE].join(" ");
