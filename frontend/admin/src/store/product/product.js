import { createCatalog } from './catalog.js';
import { createProductContext } from './context.js';
import { createDetail } from './detail.js';
import { createImages } from './images.js';
import { createNotes } from './notes.js';

// The product store is one object to the views; each part keeps one responsibility.
export function createProduct() {
  const context = createProductContext();
  const { imageFiles, imageInputs, clearSavedEdit, clearSavedDetail } = context;
  const root = {
    clearCatalog() {
      this.imageSlots.forEach((image) => this.cancelImage(image));
      clearSavedDetail();
      clearSavedEdit();
      context.requests.products?.abort();
      context.requests.types?.abort();
      context.requests.units?.abort();
      context.requests.images?.abort();
      context.requests.note?.abort();
      context.requests.shortNote?.abort();
      imageFiles.clear();
      imageInputs.clear();
      this.detailOpen = false;
      this.sidebarOpen = false;
      this.items = [];
      this.search = '';
      this.searchInput = '';
      this.selectedType = '';
      this.types = [];
      this.typesError = false;
      this.selectedUnit = '';
      this.units = [];
      this.unitsError = false;
      this.page = 1;
      this.total = 0;
      this.totalPages = 1;
      this.catalogError = '';
    },
  };
  // Copy descriptors rather than values so getters stay live.
  return Object.defineProperties({}, Object.assign({}, ...[
    createCatalog(context), createDetail(context), createNotes(context), createImages(context), root,
  ].map((part) => Object.getOwnPropertyDescriptors(part))));
}
