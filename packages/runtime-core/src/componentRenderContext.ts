import { ComponentInternalInstance } from './component'
import { devtoolsComponentUpdated } from './devtools'
import { isRenderingCompiledSlot } from './helpers/renderSlot'
import { closeBlock, openBlock } from './vnode'

/**
 * mark the current rendering instance for asset resolution (e.g.
 * resolveComponent, resolveDirective) during render
 */
export let currentRenderingInstance: ComponentInternalInstance | null = null
export let currentScopeId: string | null = null

/**
 * Note: rendering calls maybe nested. The function returns the parent rendering
 * instance if present, which should be restored after the render is done:
 *
 * ```js
 * const prev = setCurrentRenderingInstance(i)
 * // ...render
 * setCurrentRenderingInstance(prev)
 * ```
 */
export function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  currentScopeId = (instance && instance.type.__scopeId) || null
  // v2 pre-compiled components uses _scopeId instead of __scopeId
  if (__COMPAT__ && !currentScopeId) {
    currentScopeId = (instance && (instance.type as any)._scopeId) || null
  }
  return prev
}

/**
 * Set scope id when creating hoisted vnodes.
 * @private compiler helper
 */
export function pushScopeId(id: string | null) {
  currentScopeId = id
}

/**
 * Technically we no longer need this after 3.0.8 but we need to keep the same
 * API for backwards compat w/ code generated by compilers.
 * @private
 */
export function popScopeId() {
  currentScopeId = null
}

/**
 * Only for backwards compat
 * @private
 */
export const withScopeId = (_id: string) => withCtx

/**
 * Wrap a slot function to memoize current rendering instance
 * @private compiler helper
 */
export function withCtx(
  fn: Function,
  ctx: ComponentInternalInstance | null = currentRenderingInstance,
  isNonScopedSlot?: boolean // __COMPAT__ only
) {
  if (!ctx) return fn
  const renderFnWithContext = (...args: any[]) => {
    // If a user calls a compiled slot inside a template expression (#1745), it
    // can mess up block tracking, so by default we need to push a null block to
    // avoid that. This isn't necessary if rendering a compiled `<slot>`.
    if (!isRenderingCompiledSlot) {
      openBlock(true /* null block that disables tracking */)
    }
    const prevInstance = setCurrentRenderingInstance(ctx)
    const res = fn(...args)
    setCurrentRenderingInstance(prevInstance)
    if (!isRenderingCompiledSlot) {
      closeBlock()
    }

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      devtoolsComponentUpdated(ctx)
    }

    return res
  }
  // mark this as a compiled slot function.
  // this is used in vnode.ts -> normalizeChildren() to set the slot
  // rendering flag.
  renderFnWithContext._c = true
  if (__COMPAT__ && isNonScopedSlot) {
    renderFnWithContext._nonScoped = true
  }
  return renderFnWithContext
}
