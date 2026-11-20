import Swal from 'sweetalert2/dist/sweetalert2.js';

export const dialog = Swal.mixin({
  buttonsStyling: false,
  heightAuto: false,
  customClass: { popup: 'flat-dialog', confirmButton: 'button button-primary dialog-button' },
  confirmButtonText: 'ปิด',
});
