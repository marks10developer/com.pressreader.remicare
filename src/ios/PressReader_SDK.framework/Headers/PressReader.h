//
//  PressReader.h
//  PressReader
//
//  Created by Jackie Cane on 7/2/12.
//  Copyright (c) 2012 Noname. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "PRiphoneAppDelegate.h"

// Main interface of PressReader framework
@interface PressReader : PRiphoneAppDelegate

+ (instancetype)instance;
+ (void)dismiss;

- (void)launch;
- (void)stop; // finish and deallocate PressReader

@property (nonatomic, readonly) UIViewController *rootViewController;
@property (nonatomic) BOOL removeAllContent;
@property (nonatomic, strong) NSURL * launchURL;
@property (nonatomic, readonly) BOOL isStarted;
@property (nonatomic, readonly) BOOL sponsorshipActive;
@property (nonatomic, readonly, strong) NSDate * sponsorshipExpiration;
@end


