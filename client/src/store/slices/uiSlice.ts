import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Worker } from './workersSlice';

export type LayoutMode = 'single' | 'split-vertical' | 'quad';
export type DialogTone = 'info' | 'danger';
export type DialogActionVariant = 'primary' | 'ghost' | 'danger';

export interface DialogAction {
  label: string;
  variant?: DialogActionVariant;
  actionId?: string;
}

export interface DialogState {
  title: string;
  message: string;
  tone?: DialogTone;
  actions?: DialogAction[];
}

interface UIState {
  layoutMode: LayoutMode;
  sidebarCollapsed: boolean;
  isFullscreen: boolean;
  showSettings: boolean;
  showDropOverlay: boolean;
  showInstallModal: boolean;
  showWorkerModal: boolean;
  showChangePasswordModal: boolean;
  showUserMenu: boolean;
  dialog: DialogState | null;
  dialogLoading: boolean;
  shareModalWorker: Worker | null;
  editingWorker: Worker | null;
  renamingSessionId: string | null;
  installToken: string;
  copiedCommand: string | null;
}

const initialState: UIState = {
  layoutMode: 'single',
  sidebarCollapsed: false,
  isFullscreen: false,
  showSettings: false,
  showDropOverlay: false,
  showInstallModal: false,
  showWorkerModal: false,
  showChangePasswordModal: false,
  showUserMenu: false,
  dialog: null,
  dialogLoading: false,
  shareModalWorker: null,
  editingWorker: null,
  renamingSessionId: null,
  installToken: 'TU_WORKER_TOKEN',
  copiedCommand: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLayoutMode: (state, action: PayloadAction<LayoutMode>) => {
      state.layoutMode = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },
    setShowSettings: (state, action: PayloadAction<boolean>) => {
      state.showSettings = action.payload;
    },
    setShowDropOverlay: (state, action: PayloadAction<boolean>) => {
      state.showDropOverlay = action.payload;
    },
    setShowInstallModal: (state, action: PayloadAction<boolean>) => {
      state.showInstallModal = action.payload;
    },
    setShowWorkerModal: (state, action: PayloadAction<boolean>) => {
      state.showWorkerModal = action.payload;
    },
    setShowChangePasswordModal: (state, action: PayloadAction<boolean>) => {
      state.showChangePasswordModal = action.payload;
    },
    setShowUserMenu: (state, action: PayloadAction<boolean>) => {
      state.showUserMenu = action.payload;
    },
    openDialog: (state, action: PayloadAction<DialogState>) => {
      state.dialog = action.payload;
      state.dialogLoading = false;
    },
    closeDialog: (state) => {
      state.dialog = null;
      state.dialogLoading = false;
    },
    setDialogLoading: (state, action: PayloadAction<boolean>) => {
      state.dialogLoading = action.payload;
    },
    setShareModalWorker: (state, action: PayloadAction<Worker | null>) => {
      state.shareModalWorker = action.payload;
    },
    setEditingWorker: (state, action: PayloadAction<Worker | null>) => {
      state.editingWorker = action.payload;
    },
    setRenamingSessionId: (state, action: PayloadAction<string | null>) => {
      state.renamingSessionId = action.payload;
    },
    setInstallToken: (state, action: PayloadAction<string>) => {
      state.installToken = action.payload;
    },
    setCopiedCommand: (state, action: PayloadAction<string | null>) => {
      state.copiedCommand = action.payload;
    },
  },
});

export const {
  setLayoutMode,
  toggleSidebar,
  setSidebarCollapsed,
  setIsFullscreen,
  setShowSettings,
  setShowDropOverlay,
  setShowInstallModal,
  setShowWorkerModal,
  setShowChangePasswordModal,
  setShowUserMenu,
  openDialog,
  closeDialog,
  setDialogLoading,
  setShareModalWorker,
  setEditingWorker,
  setRenamingSessionId,
  setInstallToken,
  setCopiedCommand,
} = uiSlice.actions;

export default uiSlice.reducer;
