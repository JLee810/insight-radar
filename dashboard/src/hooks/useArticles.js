import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';

/**
 * Fetch a paginated/filtered list of articles.
 * @param {object} filters
 */
export function useArticles(filters = {}) {
  return useQuery({
    queryKey: ['articles', filters],
    queryFn: () => api.articles.list(filters),
    staleTime: 30_000,
  });
}

/**
 * Fetch a single article by ID.
 * @param {number|string} id
 */
export function useArticle(id) {
  return useQuery({
    queryKey: ['articles', id],
    queryFn: () => api.articles.get(id),
    enabled: Boolean(id),
  });
}

/**
 * Mutation to mark an article as read/bookmarked.
 */
export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.articles.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/**
 * Mutation to delete an article.
 */
export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.articles.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/**
 * Mutation to manually add an article by URL.
 */
export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.articles.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
