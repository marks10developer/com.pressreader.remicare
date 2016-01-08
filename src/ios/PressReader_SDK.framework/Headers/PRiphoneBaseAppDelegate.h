//
//  PRiphoneBaseAppDelegate.h
//  PRiphone
//
//  Created by Jackie Cane on 11/18/11.
//  Copyright (c) 2011 NewspaperDirect. All rights reserved.
//

#import <UIKit/UIKit.h>

@interface PRiphoneBaseAppDelegate : NSObject <UIApplicationDelegate>

- (BOOL) applicationOpenURL:(NSURL *)url;
- (BOOL) performLaunchConfigurationsWithOptions:(NSDictionary *)launchOptions;
- (void)loadRootViewController;
- (void)buyBackgroundTime;

@property (nonatomic, retain) NSDictionary *launchOptions;
@property (nonatomic) BOOL isAppLaunchedWithOptions;
@property (nonatomic, retain) IBOutlet UIWindow *window;

@end