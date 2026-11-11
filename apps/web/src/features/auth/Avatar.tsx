import type { UserDto } from '@taskflow/shared'

type AvatarProps = {
  user: Pick<UserDto, 'name' | 'avatarUrl'>
}

/** Profilkép, ennek hiányában a név kezdőbetűje. */
export function Avatar({ user }: AvatarProps) {
  if (user.avatarUrl) {
    return (
      <img
        className="avatar avatar-image"
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
      />
    )
  }

  return <div className="avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
}
