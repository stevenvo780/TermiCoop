import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionSliceState {
  connectionState: ConnectionState;
}

const initialState: ConnectionSliceState = {
  connectionState: 'connecting',
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionState: (state, action: PayloadAction<ConnectionState>) => {
      state.connectionState = action.payload;
    },
  },
});

export const { setConnectionState } = connectionSlice.actions;
export default connectionSlice.reducer;
