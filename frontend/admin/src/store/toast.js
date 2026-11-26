export function createToast() {
  let timer;
  return {
    imageToast: '',
    imageToastType: 'success',
    imageToastVersion: 0,
    showToast(message, type = 'success') {
      clearTimeout(timer);
      this.imageToastType = type;
      this.imageToast = message;
      this.imageToastVersion++;
      timer = setTimeout(() => { this.imageToast = ''; }, 4000);
    },
    dismissToast() {
      clearTimeout(timer);
      this.imageToast = '';
    },
    showImageToast(message, type = 'success') {
      this.showToast(message, type);
    },
    dismissImageToast() {
      this.dismissToast();
    },
  };
}
