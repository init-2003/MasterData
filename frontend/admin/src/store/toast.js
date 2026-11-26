export function createToast() {
  let timer;
  return {
    imageToast: '',
    imageToastType: 'success',
    imageToastVersion: 0,
    imageToastAnnounce: true,
    // Success messages close after 4 seconds. Errors stay until closed or replaced so there is time to read them.
    // Pass announce: false when the page already announces the same problem next to the control.
    showToast(message, type = 'success', { announce = true } = {}) {
      clearTimeout(timer);
      this.imageToastType = type;
      this.imageToastAnnounce = announce;
      this.imageToast = message;
      this.imageToastVersion++;
      if (type !== 'error') timer = setTimeout(() => { this.imageToast = ''; }, 4000);
    },
    // Closes the toast only if it still shows this message, for example after a retry starts.
    dismissToastMessage(message) {
      if (message && this.imageToast === message) this.dismissToast();
    },
    dismissToast() {
      clearTimeout(timer);
      this.imageToast = '';
    },
    showImageToast(message, type = 'success', options) {
      this.showToast(message, type, options);
    },
    dismissImageToast() {
      this.dismissToast();
    },
  };
}
