import { classNames } from '../../shared/lib/classNames'
import type { Task } from '../boards/types'

type ViewTaskButtonProps = {
  task: Task
  onOpen?: () => void
  className?: string
}

/** A kártya címe gombként (ha szerkeszthető), a nézetekben közösen használva. */
export function ViewTaskButton({ task, onOpen, className }: ViewTaskButtonProps) {
  if (!onOpen) {
    return <span className={classNames('view-task', className)}>{task.title}</span>
  }
  return (
    <button type="button" className={classNames('view-task', className)} onClick={onOpen}>
      {task.title}
    </button>
  )
}
