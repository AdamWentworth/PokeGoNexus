// models.go

package main

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSON type to handle JSON fields in GORM
type JSON map[string]interface{}

// Value implements the driver.Valuer interface for JSON to save JSON to the database
func (j JSON) Value() (driver.Value, error) {
	bytes, err := json.Marshal(j)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}

// Scan implements the sql.Scanner interface for JSON to retrieve JSON from the database
func (j *JSON) Scan(src interface{}) error {
	if src == nil {
		*j = make(JSON)
		return nil
	}
	switch src := src.(type) {
	case []byte:
		if err := json.Unmarshal(src, j); err != nil {
			return fmt.Errorf("failed to unmarshal JSON: %w", err)
		}
	case string:
		if err := json.Unmarshal([]byte(src), j); err != nil {
			return fmt.Errorf("failed to unmarshal JSON: %w", err)
		}
	default:
		return fmt.Errorf("unsupported type: %T", src)
	}
	return nil
}

type TrainerTitleList []string

func (titles TrainerTitleList) MarshalJSON() ([]byte, error) {
	if titles == nil {
		return []byte("[]"), nil
	}
	return json.Marshal([]string(titles))
}

func (titles TrainerTitleList) Value() (driver.Value, error) {
	if titles == nil {
		return "[]", nil
	}
	bytes, err := json.Marshal(titles)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}

func (titles *TrainerTitleList) Scan(src interface{}) error {
	if src == nil {
		*titles = TrainerTitleList{}
		return nil
	}
	var bytes []byte
	switch value := src.(type) {
	case []byte:
		bytes = value
	case string:
		bytes = []byte(value)
	default:
		return fmt.Errorf("unsupported trainer title list type: %T", src)
	}
	if len(bytes) == 0 {
		*titles = TrainerTitleList{}
		return nil
	}
	if err := json.Unmarshal(bytes, titles); err != nil {
		return fmt.Errorf("failed to unmarshal trainer titles: %w", err)
	}
	return nil
}

// ---------------- users ----------------

type User struct {
	UserID        string  `gorm:"column:user_id;primaryKey" json:"user_id"`
	Username      string  `gorm:"column:username;unique"    json:"username"`
	PokemonGoName *string `gorm:"column:pokemon_go_name"    json:"pokemonGoName,omitempty"`

	TrainerCode   *string    `gorm:"column:trainer_code"       json:"trainer_code,omitempty"`
	Team          *string    `gorm:"column:team"               json:"team,omitempty"` // 'Mystic','Valor','Instinct'
	TrainerLevel  *uint8     `gorm:"column:trainer_level"      json:"trainer_level,omitempty"`
	TotalXP       *uint64    `gorm:"column:total_xp"           json:"total_xp,omitempty"`
	PogoStartedOn *time.Time `gorm:"column:pogo_started_on"  json:"pogo_started_on,omitempty"`
	AppJoinedAt   time.Time  `gorm:"column:app_joined_at"    json:"app_joined_at"`

	AllowLocation bool     `gorm:"column:allow_location"     json:"allow_location"`
	Location      *string  `gorm:"column:location"           json:"location,omitempty"`
	Latitude      *float64 `gorm:"column:latitude"           json:"latitude,omitempty"`
	Longitude     *float64 `gorm:"column:longitude"          json:"longitude,omitempty"`

	// Highlights
	Highlight1InstanceID *string `gorm:"column:highlight1_instance_id" json:"highlight1_instance_id,omitempty"`
	Highlight2InstanceID *string `gorm:"column:highlight2_instance_id" json:"highlight2_instance_id,omitempty"`
	Highlight3InstanceID *string `gorm:"column:highlight3_instance_id" json:"highlight3_instance_id,omitempty"`
	Highlight4InstanceID *string `gorm:"column:highlight4_instance_id" json:"highlight4_instance_id,omitempty"`
	Highlight5InstanceID *string `gorm:"column:highlight5_instance_id" json:"highlight5_instance_id,omitempty"`
	Highlight6InstanceID *string `gorm:"column:highlight6_instance_id" json:"highlight6_instance_id,omitempty"`
}

func (User) TableName() string { return "users" }

// what outsiders are allowed to see
type PublicUser struct {
	UserID        string     `json:"user_id"`
	Username      string     `json:"username"`
	PokemonGoName *string    `json:"pokemonGoName,omitempty"`
	Team          *string    `json:"team,omitempty"`
	TrainerLevel  *uint8     `json:"trainer_level,omitempty"`
	TotalXP       *uint64    `json:"total_xp,omitempty"`
	PogoStartedOn *time.Time `json:"pogo_started_on,omitempty"`
	AppJoinedAt   time.Time  `json:"app_joined_at"`

	Highlight1 *string `json:"highlight1_instance_id,omitempty"`
	Highlight2 *string `json:"highlight2_instance_id,omitempty"`
	Highlight3 *string `json:"highlight3_instance_id,omitempty"`
	Highlight4 *string `json:"highlight4_instance_id,omitempty"`
	Highlight5 *string `json:"highlight5_instance_id,omitempty"`
	Highlight6 *string `json:"highlight6_instance_id,omitempty"`
}

// ---------------- profiles & social relationships ----------------

type UserProfile struct {
	UserID                  string           `gorm:"column:user_id;primaryKey" json:"user_id"`
	Bio                     *string          `gorm:"column:bio" json:"bio,omitempty"`
	TrainerTitles           TrainerTitleList `gorm:"column:trainer_titles;type:json" json:"trainer_titles"`
	ProfileVisibility       string           `gorm:"column:profile_visibility" json:"profile_visibility"`
	CollectionVisibility    string           `gorm:"column:collection_visibility" json:"collection_visibility"`
	FriendRequestPermission string           `gorm:"column:friend_request_permission" json:"friend_request_permission"`
	TrainerCodeVisibility   string           `gorm:"column:trainer_code_visibility" json:"trainer_code_visibility"`
	CoordinationMethod      string           `gorm:"column:coordination_method" json:"coordination_method"`
	CoordinationHandle      *string          `gorm:"column:coordination_handle" json:"coordination_handle,omitempty"`
	ShareTradeContact       bool             `gorm:"column:share_trade_contact" json:"share_trade_contact"`
	ShowLocation            bool             `gorm:"column:show_location" json:"show_location"`
	ShowPokemonGoName       bool             `gorm:"column:show_pokemon_go_name" json:"show_pokemon_go_name"`
	UpdatedAt               time.Time        `gorm:"column:updated_at" json:"updated_at"`
}

func (UserProfile) TableName() string { return "user_profiles" }

type Friendship struct {
	FriendshipID string     `gorm:"column:friendship_id;primaryKey" json:"friendship_id"`
	UserIDLow    string     `gorm:"column:user_id_low" json:"user_id_low"`
	UserIDHigh   string     `gorm:"column:user_id_high" json:"user_id_high"`
	RequestedBy  string     `gorm:"column:requested_by_user_id" json:"requested_by_user_id"`
	Status       string     `gorm:"column:status" json:"status"`
	CreatedAt    time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"column:updated_at" json:"updated_at"`
	AcceptedAt   *time.Time `gorm:"column:accepted_at" json:"accepted_at,omitempty"`
}

func (Friendship) TableName() string { return "friendships" }

type UserBlock struct {
	BlockerUserID string    `gorm:"column:blocker_user_id;primaryKey" json:"blocker_user_id"`
	BlockedUserID string    `gorm:"column:blocked_user_id;primaryKey" json:"blocked_user_id"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"created_at"`
}

func (UserBlock) TableName() string { return "user_blocks" }

// ---------------- custom Pokemon tags ----------------

type PokemonTag struct {
	TagID     string     `gorm:"column:tag_id;primaryKey" json:"tag_id"`
	UserID    string     `gorm:"column:user_id" json:"-"`
	Parent    string     `gorm:"column:parent" json:"parent"`
	Name      string     `gorm:"column:name" json:"name"`
	Color     string     `gorm:"column:color" json:"color"`
	Sort      int        `gorm:"column:sort" json:"sort"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt *time.Time `gorm:"column:updated_at" json:"updated_at,omitempty"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"-"`
}

func (PokemonTag) TableName() string { return "tags" }

type PokemonTagOrder struct {
	UserID    string    `gorm:"column:user_id;primaryKey" json:"-"`
	Parent    string    `gorm:"column:parent;primaryKey" json:"parent"`
	TagKeys   RawJSON   `gorm:"column:tag_keys;type:json" json:"tag_keys"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (PokemonTagOrder) TableName() string { return "tag_orders" }

type PokemonInstanceTag struct {
	TagID      string    `gorm:"column:tag_id;primaryKey"`
	InstanceID string    `gorm:"column:instance_id;primaryKey"`
	UserID     string    `gorm:"column:user_id"`
	CreatedAt  time.Time `gorm:"column:created_at"`
}

func (PokemonInstanceTag) TableName() string { return "instance_tags" }

// ---------------- instances ----------------

type PokemonInstance struct {
	InstanceID string `gorm:"column:instance_id;primaryKey" json:"instance_id"`
	UserID     string `gorm:"column:user_id"                 json:"user_id"`
	User       *User  `gorm:"foreignKey:UserID;references:UserID" json:"user,omitempty"`

	VariantID *string `gorm:"column:variant_id" json:"variant_id,omitempty"`
	PokemonID int     `gorm:"column:pokemon_id" json:"pokemon_id"`
	Nickname  *string `gorm:"column:nickname"   json:"nickname"`
	Gender    *string `gorm:"column:gender"     json:"gender"`

	// Stats
	CP        *int     `gorm:"column:cp"          json:"cp"`
	AttackIV  *int     `gorm:"column:attack_iv"   json:"attack_iv"`
	DefenseIV *int     `gorm:"column:defense_iv"  json:"defense_iv"`
	StaminaIV *int     `gorm:"column:stamina_iv"  json:"stamina_iv"`
	Level     *float64 `gorm:"column:level"       json:"level"`
	Weight    *float64 `gorm:"column:weight"      json:"weight"`
	Height    *float64 `gorm:"column:height"      json:"height"`

	// Early form flags
	Shiny     bool `gorm:"column:shiny"     json:"shiny"`
	CostumeID *int `gorm:"column:costume_id" json:"costume_id"`
	Lucky     bool `gorm:"column:lucky"     json:"lucky"`
	Shadow    bool `gorm:"column:shadow"    json:"shadow"`
	Purified  bool `gorm:"column:purified"  json:"purified"`

	// Moves
	FastMoveID     *int `gorm:"column:fast_move_id"     json:"fast_move_id"`
	ChargedMove1ID *int `gorm:"column:charged_move1_id" json:"charged_move1_id"`
	ChargedMove2ID *int `gorm:"column:charged_move2_id" json:"charged_move2_id"`

	// Location & timestamps
	Pokeball       *string    `gorm:"column:pokeball"        json:"pokeball"`
	LocationCard   *string    `gorm:"column:location_card"   json:"location_card"`
	LocationCaught *string    `gorm:"column:location_caught" json:"location_caught"`
	DateCaught     *time.Time `gorm:"column:date_caught"    json:"date_caught"`
	DateAdded      time.Time  `gorm:"column:date_added"     json:"date_added"`
	LastUpdate     int64      `gorm:"column:last_update"    json:"last_update"`
	Disabled       bool       `gorm:"column:disabled"       json:"disabled"`

	// Trade provenance
	IsTraded            bool       `gorm:"column:is_traded"              json:"is_traded"`
	TradedDate          *time.Time `gorm:"column:traded_date"           json:"traded_date"`
	OriginalTrainerID   *string    `gorm:"column:original_trainer_id"   json:"original_trainer_id"`
	OriginalTrainerName *string    `gorm:"column:original_trainer_name" json:"original_trainer_name"`

	// Mega / Dynamax / Crown + max stats
	Mega       bool    `gorm:"column:mega"        json:"mega"`
	MegaForm   *string `gorm:"column:mega_form"   json:"mega_form"`
	IsMega     *bool   `gorm:"column:is_mega"     json:"is_mega"`
	Dynamax    bool    `gorm:"column:dynamax"     json:"dynamax"`
	Gigantamax bool    `gorm:"column:gigantamax"  json:"gigantamax"`
	Crown      bool    `gorm:"column:crown"       json:"crown"`
	MaxAttack  *string `gorm:"column:max_attack"  json:"max_attack"`
	MaxGuard   *string `gorm:"column:max_guard"   json:"max_guard"`
	MaxSpirit  *string `gorm:"column:max_spirit"  json:"max_spirit"`

	// Other forms
	IsFused    bool    `gorm:"column:is_fused"    json:"is_fused"`
	Fusion     JSON    `gorm:"column:fusion;type:json"     json:"fusion"`
	FusionForm *string `gorm:"column:fusion_form" json:"fusion_form"`
	FusedWith  *string `gorm:"column:fused_with"  json:"fused_with"`

	// Ownership & tags
	IsCaught      bool    `gorm:"column:is_caught"      json:"is_caught"`
	IsForTrade    bool    `gorm:"column:is_for_trade"   json:"is_for_trade"`
	IsWanted      bool    `gorm:"column:is_wanted"      json:"is_wanted"`
	MostWanted    bool    `gorm:"column:most_wanted"    json:"most_wanted"`
	CaughtTags    RawJSON `gorm:"column:caught_tags;type:json"  json:"caught_tags"`
	TradeTags     RawJSON `gorm:"column:trade_tags;type:json"   json:"trade_tags"`
	WantedTags    RawJSON `gorm:"column:wanted_tags;type:json"  json:"wanted_tags"`
	NotTradeList  RawJSON `gorm:"column:not_trade_list;type:json"  json:"not_trade_list"`
	NotWantedList RawJSON `gorm:"column:not_wanted_list;type:json" json:"not_wanted_list"`
	TradeFilters  JSON    `gorm:"column:trade_filters;type:json"  json:"trade_filters"`
	WantedFilters JSON    `gorm:"column:wanted_filters;type:json" json:"wanted_filters"`
	WantedSizes   RawJSON `gorm:"column:wanted_size_preferences;type:json" json:"wanted_size_preferences"`

	// Misc
	FriendshipLevel *int    `gorm:"column:friendship_level" json:"friendship_level"`
	Mirror          bool    `gorm:"column:mirror"           json:"mirror"`
	PrefLucky       bool    `gorm:"column:pref_lucky"       json:"pref_lucky"`
	Registered      bool    `gorm:"column:registered"       json:"registered"`
	Favorite        bool    `gorm:"column:favorite"         json:"favorite"`
	TraceID         *string `gorm:"column:trace_id"        json:"trace_id"`
}

func (PokemonInstance) TableName() string { return "instances" }

// ---------------- registrations ----------------

type Registration struct {
	UserID    string `gorm:"column:user_id;primaryKey"    json:"user_id"`
	VariantID string `gorm:"column:variant_id;primaryKey" json:"variant_id"`
}

func (Registration) TableName() string {
	// Adjust if your table is named just "registrations"
	return "registrations"
}

// ---------------- trades ----------------

type Trade struct {
	TradeID                          string     `gorm:"column:trade_id;primaryKey" json:"trade_id"`
	UserIDProposed                   string     `gorm:"column:user_id_proposed" json:"user_id_proposed"`
	UsernameProposed                 string     `gorm:"column:username_proposed" json:"username_proposed"`
	UserIDAccepting                  string     `gorm:"column:user_id_accepting" json:"user_id_accepting"`
	UsernameAccepting                string     `gorm:"column:username_accepting" json:"username_accepting"`
	PokemonInstanceIDUserProposed    string     `gorm:"column:pokemon_instance_id_user_proposed" json:"pokemon_instance_id_user_proposed"`
	PokemonInstanceIDUserAccepting   string     `gorm:"column:pokemon_instance_id_user_accepting" json:"pokemon_instance_id_user_accepting"`
	TradeStatus                      string     `gorm:"column:trade_status" json:"trade_status"`
	UserProposedCompletionConfirmed  bool       `gorm:"column:user_proposed_completion_confirmed" json:"user_proposed_completion_confirmed"`
	UserAcceptingCompletionConfirmed bool       `gorm:"column:user_accepting_completion_confirmed" json:"user_accepting_completion_confirmed"`
	TradeProposalDate                *time.Time `gorm:"column:trade_proposal_date" json:"trade_proposal_date"`
	TradeAcceptedDate                *time.Time `gorm:"column:trade_accepted_date" json:"trade_accepted_date"`
	TradeCompletedDate               *time.Time `gorm:"column:trade_completed_date" json:"trade_completed_date"`
	TradeCancelledDate               *time.Time `gorm:"column:trade_cancelled_date" json:"trade_cancelled_date"`
	TradeCancelledBy                 *string    `gorm:"column:trade_cancelled_by" json:"trade_cancelled_by"`
	IsSpecialTrade                   bool       `gorm:"column:is_special_trade" json:"is_special_trade"`
	IsRegisteredTrade                bool       `gorm:"column:is_registered_trade" json:"is_registered_trade"`
	IsLuckyTrade                     bool       `gorm:"column:is_lucky_trade" json:"is_lucky_trade"`
	TradeDustCost                    *int       `gorm:"column:trade_dust_cost" json:"trade_dust_cost"`
	TradeFriendshipLevel             string     `gorm:"column:trade_friendship_level" json:"trade_friendship_level"`
	User1TradeSatisfaction           *bool      `gorm:"column:user_1_trade_satisfaction" json:"user_1_trade_satisfaction"`
	User2TradeSatisfaction           *bool      `gorm:"column:user_2_trade_satisfaction" json:"user_2_trade_satisfaction"`
	TraceID                          *string    `gorm:"column:trace_id" json:"trace_id"`
	LastUpdate                       *int64     `gorm:"column:last_update" json:"last_update"`
}

func (Trade) TableName() string {
	return "trades"
}
