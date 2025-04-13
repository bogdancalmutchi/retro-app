export const getArrayFromLocalStorage = (localStorageKey: string) => {
  const storedArray = localStorage.getItem(localStorageKey);
  return storedArray ? JSON.parse(storedArray) : [];
}

export const addItemToLocalStorage = (item: string, localStorageKey: string) => {
  const array = getArrayFromLocalStorage(localStorageKey);
  array.push(item);
  localStorage.setItem(localStorageKey, JSON.stringify(array));
}

export const removeItemFromLocalStorage = (item: string, localStorageKey: string) => {
  let array = getArrayFromLocalStorage(localStorageKey);
  array = array.filter((i: string) => i !== item);
  localStorage.setItem(localStorageKey, JSON.stringify(array));
}

export const cookieLifetime = new Date(new Date().getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
