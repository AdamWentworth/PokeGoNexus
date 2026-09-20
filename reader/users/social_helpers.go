package main

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

const (
	relationshipNone     = "none"
	relationshipSelf     = "self"
	relationshipFriend   = "friend"
	relationshipIncoming = "incoming"
	relationshipOutgoing = "outgoing"
	relationshipBlocked  = "blocked"
)

func defaultUserProfile(userID string) UserProfile {
	return UserProfile{
		UserID:                  userID,
		TrainerTitles:           TrainerTitleList{},
		ProfileVisibility:       "public",
		CollectionVisibility:    "public",
		FriendRequestPermission: "everyone",
		TrainerCodeVisibility:   "friends",
		CoordinationMethod:      "campfire",
		ShareTradeContact:       true,
		ShowPokemonGoName:       true,
		ShowLocation:            false,
	}
}

func loadUserProfile(userID string) (UserProfile, error) {
	profile := defaultUserProfile(userID)
	var stored UserProfile
	err := db.Where("user_id = ?", userID).First(&stored).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return profile, nil
	}
	if err != nil {
		return profile, err
	}
	return stored, nil
}

func canonicalFriendPair(left, right string) (string, string) {
	if strings.Compare(left, right) <= 0 {
		return left, right
	}
	return right, left
}

func friendshipForUsers(left, right string) (*Friendship, error) {
	low, high := canonicalFriendPair(left, right)
	var friendship Friendship
	err := db.Where("user_id_low = ? AND user_id_high = ?", low, high).First(&friendship).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &friendship, err
}

func usersAreBlocked(left, right string) (bool, error) {
	var count int64
	err := db.Model(&UserBlock{}).
		Where("(blocker_user_id = ? AND blocked_user_id = ?) OR (blocker_user_id = ? AND blocked_user_id = ?)",
			left, right, right, left).
		Count(&count).Error
	return count > 0, err
}

func relationshipForUsers(viewerID, targetID string) (string, *Friendship, error) {
	if viewerID == "" {
		return relationshipNone, nil, nil
	}
	if viewerID == targetID {
		return relationshipSelf, nil, nil
	}
	blocked, err := usersAreBlocked(viewerID, targetID)
	if err != nil {
		return relationshipNone, nil, err
	}
	if blocked {
		return relationshipBlocked, nil, nil
	}
	friendship, err := friendshipForUsers(viewerID, targetID)
	if err != nil || friendship == nil {
		return relationshipNone, friendship, err
	}
	if friendship.Status == "accepted" {
		return relationshipFriend, friendship, nil
	}
	if friendship.Status == "pending" {
		if friendship.RequestedBy == viewerID {
			return relationshipOutgoing, friendship, nil
		}
		return relationshipIncoming, friendship, nil
	}
	return relationshipNone, friendship, nil
}

func visibilityAllows(value, relationship string) bool {
	if relationship == relationshipSelf {
		return true
	}
	switch value {
	case "private":
		return false
	case "friends":
		return relationship == relationshipFriend
	default:
		return relationship != relationshipBlocked
	}
}

func collectionAccessForUser(viewerID, targetID string) (bool, string, error) {
	relationship, _, err := relationshipForUsers(viewerID, targetID)
	if err != nil {
		return false, relationship, err
	}
	profile, err := loadUserProfile(targetID)
	if err != nil {
		return false, relationship, err
	}
	return visibilityAllows(profile.CollectionVisibility, relationship), relationship, nil
}
