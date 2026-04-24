export function getVideoDurationSeconds(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Не е избран видео файл.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const settle = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const { duration } = video;
      settle(() => resolve(duration));
    };
    video.onerror = () => {
      settle(() => reject(new Error('Не успяхме да прочетем продължителността на видеото.')));
    };
    timeoutId = setTimeout(() => {
      settle(() =>
        reject(new Error('Четенето на видеото отне твърде дълго. Моля, опитайте с друг MP4 файл.'))
      );
    }, 10000);

    video.src = objectUrl;
  });
}
