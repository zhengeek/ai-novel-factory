import { defineComponent, h, ref, type CSSProperties, type PropType } from 'vue'

// Local splitpanes-compatible layer kept as a build fallback for network-restricted installs.
type PaneResizePayload = Array<{ size: number }>

function toNumber(value: number | string | undefined, fallback: number): number {
  const nextValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const Pane = defineComponent({
  name: 'Pane',
  props: {
    size: {
      type: [Number, String] as PropType<number | string>,
      default: 50,
    },
    minSize: {
      type: [Number, String] as PropType<number | string>,
      default: 0,
    },
    maxSize: {
      type: [Number, String] as PropType<number | string>,
      default: 100,
    },
  },
  setup(props, { slots }) {
    return () => {
      const size = toNumber(props.size, 50)
      const style: CSSProperties = {
        flexBasis: `${size}%`,
      }

      return h(
        'div',
        {
          class: 'splitpanes__pane',
          style,
          'data-min-size': props.minSize,
          'data-max-size': props.maxSize,
        },
        slots.default?.(),
      )
    }
  },
})

export const Splitpanes = defineComponent({
  name: 'Splitpanes',
  emits: {
    resized: (_panes: PaneResizePayload) => true,
  },
  setup(_props, { emit, slots }) {
    const root = ref<HTMLElement | null>(null)

    function startDrag(event: PointerEvent): void {
      const splitter = event.currentTarget as HTMLElement
      const previousPane = splitter.previousElementSibling as HTMLElement | null
      const minSize = toNumber(previousPane?.dataset.minSize, 0)
      const maxSize = toNumber(previousPane?.dataset.maxSize, 100)

      event.preventDefault()
      splitter.setPointerCapture?.(event.pointerId)

      function handlePointerMove(moveEvent: PointerEvent): void {
        if (!root.value) return

        const rect = root.value.getBoundingClientRect()
        const nextSize = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, minSize, maxSize)

        emit('resized', [{ size: nextSize }, { size: 100 - nextSize }])
      }

      function stopDrag(upEvent: PointerEvent): void {
        splitter.releasePointerCapture?.(upEvent.pointerId)
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', stopDrag)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopDrag)
    }

    return () => {
      const children = slots.default?.() ?? []
      const nodes = children.flatMap((child, index) =>
        index === 0
          ? [child]
          : [
              h('div', {
                class: 'splitpanes__splitter',
                role: 'separator',
                title: '拖拽调整上下文面板宽度',
                onPointerdown: startDrag,
              }),
              child,
            ],
      )

      return h('div', { ref: root, class: 'splitpanes splitpanes--vertical' }, nodes)
    }
  },
})
