import { useState, useCallback } from 'react';
import axios from 'axios';
import { PublicBusinessRecord, CategorySummary, NearbyQuery, BoundingBox } from '../types/business';

const API_BASE = '/api/v1';

export interface UseBusinessData {
  businesses: PublicBusinessRecord[];
  cityCategories: CategorySummary[];
  /** True while a bounding-box or nearby fetch is in flight */
  businessesLoading: boolean;
  /** True while the city-wide category baseline fetch is in flight */
  categoriesLoading: boolean;
  error: string | null;
  fetchByBoundingBox: (bbox: BoundingBox) => Promise<void>;
  fetchNearby: (query: NearbyQuery) => Promise<void>;
  /** Fetch city-wide category counts (used as the gap-analysis baseline) */
  fetchCityCategories: () => Promise<void>;
  clearError: () => void;
}

export function useBusinessData(): UseBusinessData {
  const [businesses, setBusinesses] = useState<PublicBusinessRecord[]>([]);
  const [cityCategories, setCityCategories] = useState<CategorySummary[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchByBoundingBox = useCallback(async (bbox: BoundingBox): Promise<void> => {
    setBusinessesLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<PublicBusinessRecord[]>(`${API_BASE}/businesses`, {
        params: bbox,
      });
      setBusinesses(data);
    } catch {
      setError('Unable to load business data. Please try again.');
    } finally {
      setBusinessesLoading(false);
    }
  }, []);

  const fetchNearby = useCallback(async (query: NearbyQuery): Promise<void> => {
    setBusinessesLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<PublicBusinessRecord[]>(`${API_BASE}/businesses/nearby`, {
        params: { lat: query.lat, lng: query.lng, radius: query.radius, limit: 500 },
      });
      setBusinesses(data);
    } catch {
      setError('Unable to load nearby businesses. Please try again.');
    } finally {
      setBusinessesLoading(false);
    }
  }, []);

  const fetchCityCategories = useCallback(async (): Promise<void> => {
    setCategoriesLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<CategorySummary[]>(`${API_BASE}/businesses/categories`);
      setCityCategories(data);
    } catch {
      setError('Unable to load business categories. Please try again.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  return {
    businesses,
    cityCategories,
    businessesLoading,
    categoriesLoading,
    error,
    fetchByBoundingBox,
    fetchNearby,
    fetchCityCategories,
    clearError,
  };
}
