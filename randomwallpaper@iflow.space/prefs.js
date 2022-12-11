const Adw = imports.gi.Adw;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

const Self = ExtensionUtils.getCurrentExtension();
const WallpaperController = Self.imports.wallpaperController;
const LoggerModule = Self.imports.logger;

const RWG_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.space.iflow.randomwallpaper';
const RWG_SETTINGS_SCHEMA_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.unsplash';
const RWG_SETTINGS_SCHEMA_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.wallhaven';
const RWG_SETTINGS_SCHEMA_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.reddit';
const RWG_SETTINGS_SCHEMA_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.genericJSON';

function init(metaData) {
	//Convenience.initTranslations();
}

// https://gitlab.gnome.org/GNOME/gjs/-/blob/master/examples/gtk4-template.js
const SourceRow = GObject.registerClass({
	GTypeName: 'SourceRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/source_row.ui', null),
	Children: [
		'source_combo',
		'source_settings_container',
		'source_id',
	]
}, class SourceRow extends Adw.ExpanderRow {
	constructor(params = {}) {
		super(params);
	}
});

const UnsplashRow = GObject.registerClass({
	GTypeName: 'UnsplashRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/unsplash.ui', null),
	Children: [
		'unsplash_keyword',
		'unsplash_featured_only',
		'unsplash_image_width',
		'unsplash_image_height',
		'unsplash_constraint_type',
		'unsplash_constraint_value'
	]
}, class UnsplashRow extends Adw.PreferencesGroup {
	constructor(params = {}) {
		super(params);
	}
});

const WallhavenRow = GObject.registerClass({
	GTypeName: 'WallhavenRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/wallhaven.ui', null),
	Children: [
		'wallhaven_keyword',
		'wallhaven_api_key',
		'wallhaven_resolutions',
		'wallhaven_allow_sfw',
		'wallhaven_allow_sketchy',
		'wallhaven_allow_nsfw',
		'wallhaven_category_general',
		'wallhaven_category_anime',
		'wallhaven_category_people'
	]
}, class WallhavenRow extends Adw.PreferencesGroup {
	constructor(params = {}) {
		super(params);
	}
});

const RedditRow = GObject.registerClass({
	GTypeName: 'RedditRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/reddit.ui', null),
	Children: [
		'reddit_allow_sfw',
		'reddit_subreddits'
	]
}, class RedditRow extends Adw.PreferencesGroup {
	constructor(params = {}) {
		super(params);
	}
});

const GenericJsonRow = GObject.registerClass({
	GTypeName: 'GenericJsonRow',
	Template: GLib.filename_to_uri(Self.path + '/ui/generic_json.ui', null),
	Children: [
		'generic_json_domain',
		'generic_json_request_url',
		'generic_json_image_path',
		'generic_json_image_prefix',
		'generic_json_post_path',
		'generic_json_post_prefix',
		'generic_json_author_name_path',
		'generic_json_author_url_path',
		'generic_json_author_url_prefix'
	]
}, class GenericJsonRow extends Adw.PreferencesGroup {
	constructor(params = {}) {
		super(params);
	}
});

// https://gjs.guide/extensions/development/preferences.html#preferences-window
function fillPreferencesWindow(window) {
	new RandomWallpaperSettings(window);
}

/* UI Setup */
var RandomWallpaperSettings = class {
	constructor(window) {
		this.logger = new LoggerModule.Logger('RWG3', 'RandomWallpaper.Settings');

		this._wallpaperController = null;

		this._settings = ExtensionUtils.getSettings(RWG_SETTINGS_SCHEMA);
		this._builder = new Gtk.Builder();
		//this._builder.set_translation_domain(Self.metadata['gettext-domain']);
		this._builder.add_from_file(Self.path + '/ui/page_general.ui');
		this._builder.add_from_file(Self.path + '/ui/page_sources.ui');

		this.source_row = new SourceRow();
		this._builder.get_object('sources_list').add(this.source_row);

		// Unsplash Settings
		this._unsplash_settings = ExtensionUtils.getSettings(RWG_SETTINGS_SCHEMA_UNSPLASH);
		this.unsplashSettings = new UnsplashRow();
		this.bindUnsplash(this.unsplashSettings);

		// Wallhaven Settings
		this._wallhaven_settings = ExtensionUtils.getSettings(RWG_SETTINGS_SCHEMA_WALLHAVEN);
		this.wallhavenSettings = new WallhavenRow();
		this.bindWallhaven(this.wallhavenSettings);

		// Reddit Settings
		this._reddit_settings = ExtensionUtils.getSettings(RWG_SETTINGS_SCHEMA_REDDIT);
		this.redditSettings = new RedditRow();
		this.bindReddit(this.redditSettings);

		// Generic JSON Settings
		this._generic_json_settings = ExtensionUtils.getSettings(RWG_SETTINGS_SCHEMA_GENERIC_JSON);
		this.genericJsonSettings = new GenericJsonRow();
		this.bindGenericJSON(this.genericJsonSettings);

		this._toggleAfSliders();

		this._builder.get_object('af_switch').connect('notify::active', function (toggleSwitch) {
			this._toggleAfSliders();
		}.bind(this));

		this.source_row.source_combo.connect('changed', (sourceCombo) => {
			let targetWidget = null;
			switch (sourceCombo.active) {
				case 0: // unsplash
					targetWidget = this.unsplashSettings;
					break;
				case 1: // wallhaven
					targetWidget = this.wallhavenSettings;
					break;
				case 2: // reddit
					targetWidget = this.redditSettings;
					break;
				case 3: // generic JSON
					targetWidget = this.genericJsonSettings;
					break;
				default:
					targetWidget = null;
					this.logger.error("The selected source has no corresponding widget!")
					break;
			}

			if (targetWidget !== null) {
				this.source_row.source_settings_container.set_child(targetWidget);
			}
		});

		this._settings.bind('history-length',
			this._builder.get_object('history_length'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('minutes',
			this._builder.get_object('duration_minutes'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('hours',
			this._builder.get_object('duration_hours'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		// FIXME: I've changed the gsettings schema to int
		this._settings.bind('source',
			this.source_row.source_combo,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('auto-fetch',
			this._builder.get_object('af_switch'),
			'enable-expansion',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('change-lock-screen',
			this._builder.get_object('change_lock_screen'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('disable-hover-preview',
			this._builder.get_object('disable_hover_preview'),
			'active',
			Gio.SettingsBindFlags.DEFAULT)
		this._settings.bind('hide-panel-icon',
			this._builder.get_object('hide_panel_icon'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('fetch-on-startup',
			this._builder.get_object('fetch_on_startup'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._wallpaperController = new WallpaperController.WallpaperController(true);
		this._bindButtons();

		window.add(this._builder.get_object('page_general'));
		window.add(this._builder.get_object('page_sources'));
	}

	_toggleAfSliders() {
		if (this._builder.get_object('af_switch').get_enable_expansion()) {
			this._builder.get_object('duration_slider_hours').set_sensitive(true);
			this._builder.get_object('duration_slider_minutes').set_sensitive(true);
		} else {
			this._builder.get_object('duration_slider_hours').set_sensitive(false);
			this._builder.get_object('duration_slider_minutes').set_sensitive(false);
		}
	}

	bindUnsplash(widget) {
		this._unsplash_settings.bind('unsplash-keyword',
			widget.unsplash_keyword,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('unsplash-image-width',
			widget.unsplash_image_width,
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('unsplash-image-height',
			widget.unsplash_image_height,
			'value',
			Gio.SettingsBindFlags.DEFAULT);

		const unsplash_featured_only = widget.unsplash_featured_only;
		const unsplash_constraint_type = widget.unsplash_constraint_type;
		const unsplash_constraint_value = widget.unsplash_constraint_value;

		this._unsplash_settings.bind('unsplash-featured-only',
			unsplash_featured_only,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		// FIXME: I've changed the gsettings schema to int
		this._unsplash_settings.bind('unsplash-constraint-type',
			unsplash_constraint_type,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('unsplash-constraint-value',
			unsplash_constraint_value,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._unsplashUnconstrained(unsplash_constraint_type, true, unsplash_featured_only);
		this._unsplashUnconstrained(unsplash_constraint_type, false, unsplash_constraint_value);
		unsplash_constraint_type.connect('changed', (combo) => {
			this._unsplashUnconstrained(combo, true, unsplash_featured_only);
			this._unsplashUnconstrained(combo, false, unsplash_constraint_value);

			unsplash_featured_only.set_active(false);
		});
	}

	_unsplashUnconstrained(combobox, enable, targetElement) {
		// FIXME: I've changed the gsettings schema to int
		if (combobox.active === 0) {
			targetElement.set_sensitive(enable);
		} else {
			targetElement.set_sensitive(!enable);
		}
	}

	bindWallhaven(widget) {
		this._wallhaven_settings.bind('wallhaven-keyword',
			widget.wallhaven_keyword,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('wallhaven-api-key',
			widget.wallhaven_api_key,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('resolutions',
			widget.wallhaven_resolutions,
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._wallhaven_settings.bind('category-general',
			widget.wallhaven_category_general,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('category-anime',
			widget.wallhaven_category_anime,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('category-people',
			widget.wallhaven_category_people,
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._wallhaven_settings.bind('allow-sfw',
			widget.wallhaven_allow_sfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('allow-sketchy',
			widget.wallhaven_allow_sketchy,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('allow-nsfw',
			widget.wallhaven_allow_nsfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
	}

	bindReddit(widget) {
		this._reddit_settings.bind('subreddits',
			widget.reddit_subreddits,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._reddit_settings.bind('allow-sfw',
			widget.reddit_allow_sfw,
			'active',
			Gio.SettingsBindFlags.DEFAULT);
	}

	bindGenericJSON(widget) {
		this._generic_json_settings.bind('generic-json-id',
			this.source_row.source_id,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-domain',
			widget.generic_json_domain,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-request-url',
			widget.generic_json_request_url,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-image-path',
			widget.generic_json_image_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-image-prefix',
			widget.generic_json_image_prefix,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-post-path',
			widget.generic_json_post_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-post-prefix',
			widget.generic_json_post_prefix,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-author-name-path',
			widget.generic_json_author_name_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-author-url-path',
			widget.generic_json_author_url_path,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-author-url-prefix',
			widget.generic_json_author_url_prefix,
			'text',
			Gio.SettingsBindFlags.DEFAULT);
	}

	_bindButtons() {
		let newWallpaperButton = this._builder.get_object('request_new_wallpaper');
		let origNewWallpaperText = newWallpaperButton.get_child().get_label();
		newWallpaperButton.connect('activated', () => {
			newWallpaperButton.get_child().set_label("Loading ...");
			newWallpaperButton.set_sensitive(false);

			this._wallpaperController.update();
			this._wallpaperController.fetchNewWallpaper(() => {
				this._wallpaperController.update();
				newWallpaperButton.get_child().set_label(origNewWallpaperText);
				newWallpaperButton.set_sensitive(true);
			});
		});

		this._builder.get_object('clear_history').connect('clicked', () => {
			this._wallpaperController.update();
			this._wallpaperController.deleteHistory();
		});

		this._builder.get_object('open_wallpaper_folder').connect('clicked', () => {
			let uri = GLib.filename_to_uri(this._wallpaperController.wallpaperlocation, "");
			Gio.AppInfo.launch_default_for_uri(uri, Gio.AppLaunchContext.new());
		});
	}

};