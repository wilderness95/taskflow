import { useTranslation } from 'react-i18next'
import { listBoardActivity } from '../../api/activity'
import { Modal } from '../../shared/ui/Modal'
import { ActivityList } from './ActivityList'

type BoardActivityModalProps = { boardId: string; onClose: () => void }

/** A tábla tevékenységnaplója (ember és API kulcs által végzett írások). */
export function BoardActivityModal({ boardId, onClose }: BoardActivityModalProps) {
  const { t } = useTranslation('activity')
  return (
    <Modal eyebrow={t('boardEyebrow')} title={t('boardTitle')} onClose={onClose}>
      <ActivityList
        queryKey={['board', boardId, 'activity']}
        fetchPage={(cursor) => listBoardActivity(boardId, cursor)}
      />
    </Modal>
  )
}
