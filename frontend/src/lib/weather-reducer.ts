import type { LocationRecord, WeatherObservation } from "./weather";

export type AppState = {
  locations: LocationRecord[];
  selectedLocation: LocationRecord | null;
  observations: WeatherObservation[];
  pending: number;
  error: string | null;
};

export type Action =
  | { type: "SET_LOCATIONS"; locations: LocationRecord[] }
  | {
      type: "SELECT_LOCATION";
      location: LocationRecord;
      observations: WeatherObservation[];
    }
  | { type: "ADD_LOCATION"; location: LocationRecord }
  | { type: "REMOVE_LOCATION"; locationKey: string }
  | { type: "BEGIN_PENDING" }
  | { type: "END_PENDING" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "CLEAR_SELECTION" };

export const initialState: AppState = {
  locations: [],
  selectedLocation: null,
  observations: [],
  pending: 0,
  error: null,
};

export function weatherReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_LOCATIONS":
      return { ...state, locations: action.locations };
    case "SELECT_LOCATION":
      return {
        ...state,
        selectedLocation: action.location,
        observations: action.observations,
        error: null,
      };
    case "ADD_LOCATION":
      return { ...state, locations: [...state.locations, action.location] };
    case "REMOVE_LOCATION": {
      const wasSelected =
        state.selectedLocation?.locationKey === action.locationKey;
      return {
        ...state,
        locations: state.locations.filter(
          (loc) => loc.locationKey !== action.locationKey,
        ),
        selectedLocation: wasSelected ? null : state.selectedLocation,
        observations: wasSelected ? [] : state.observations,
      };
    }
    case "BEGIN_PENDING":
      return { ...state, pending: state.pending + 1 };
    case "END_PENDING":
      return { ...state, pending: Math.max(0, state.pending - 1) };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "CLEAR_SELECTION":
      return { ...state, selectedLocation: null, observations: [] };
    default:
      return state;
  }
}
