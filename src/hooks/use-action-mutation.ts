"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

type Options<TVars, TData> = {
  invalidate?: QueryKey[] | ((vars: TVars) => QueryKey[]);
  onMutate?: (vars: TVars) => unknown;
  onSuccess?: (data: TData | undefined, vars: TVars) => void;
  onError?: (error: Error, vars: TVars) => void;
  silent?: boolean;
  errorToast?: boolean;
};

export function useActionMutation<TVars, TData = unknown>(
  action: (vars: TVars) => Promise<ActionResult<TData>>,
  options: Options<TVars, TData> = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const result = await action(vars);
      if (!result.ok) {
        throw new Error(result.error);
      }

      return result;
    },
    onMutate: options.onMutate,
    onSuccess: (result, vars) => {
      if (result.message && !options.silent) {
        toast.success(result.message);
      }

      options.onSuccess?.(result.data, vars);
    },
    onError: (error, vars) => {
      if (options.errorToast !== false) {
        toast.error(error.message);
      }
      options.onError?.(error, vars);
    },
    onSettled: (_result, _error, vars) => {
      const keys = typeof options.invalidate === "function" ? options.invalidate(vars) : options.invalidate;
      return Promise.all((keys ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}
